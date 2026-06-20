package service

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/jung-kurt/gofpdf"
	"github.com/xuri/excelize/v2"
)

// 使用日志导出
//
//   - 数据量小（<= SyncExportThreshold）时同步生成并直接返回文件；
//   - 数据量大时转为后台异步任务生成，前端轮询状态，完成后下载；
//   - 文件在被成功下载后立即删除（一次性），并由后台清理过期/残留文件，避免占用磁盘。
//   - 分批从数据库读取，避免一次性加载海量数据影响线上业务。

const (
	// SyncExportThreshold 同步导出的行数上限，超过则转异步
	SyncExportThreshold = 5000
	// exportBatchSize 分批拉取的每批行数
	exportBatchSize = 1000
	// exportMaxRows 单次导出最大行数硬上限，防止极端情况下耗尽资源
	exportMaxRows = 200000
	// exportFileTTL 异步导出文件最长保留时间（兜底清理）
	exportFileTTL = 30 * time.Minute
)

// LogExportFormat 导出格式
type LogExportFormat string

const (
	LogExportFormatXLSX LogExportFormat = "xlsx"
	LogExportFormatPDF  LogExportFormat = "pdf"
)

// LogExportStatus 异步任务状态
type LogExportStatus string

const (
	LogExportStatusPending LogExportStatus = "pending"
	LogExportStatusRunning LogExportStatus = "running"
	LogExportStatusDone    LogExportStatus = "done"
	LogExportStatusFailed  LogExportStatus = "failed"
)

// LogExportJob 异步导出任务
type LogExportJob struct {
	Id        string          `json:"id"`
	UserId    int             `json:"user_id"`
	Format    LogExportFormat `json:"format"`
	Status    LogExportStatus `json:"status"`
	Progress  int             `json:"progress"` // 已处理行数
	Total     int             `json:"total"`
	FilePath  string          `json:"-"`
	FileName  string          `json:"file_name"`
	Error     string          `json:"error,omitempty"`
	CreatedAt int64           `json:"created_at"`
}

// LogPageFetcher 分页拉取日志的函数；startIdx 为偏移，num 为本批数量。
// 返回本批日志与总数（总数仅首批需要准确）。
type LogPageFetcher func(startIdx, num int) ([]*model.Log, int64, error)

var (
	logExportJobs   = make(map[string]*LogExportJob)
	logExportJobsMu sync.RWMutex
)

// 导出列定义
var logExportHeaders = []string{
	"ID", "时间", "类型", "用户", "令牌", "模型", "分组",
	"提示Tokens", "补全Tokens", "额度", "用时(秒)", "渠道", "详情",
}

func logTypeText(t int) string {
	switch t {
	case model.LogTypeTopup:
		return "充值"
	case model.LogTypeConsume:
		return "消费"
	case model.LogTypeManage:
		return "管理"
	case model.LogTypeSystem:
		return "系统"
	case model.LogTypeError:
		return "错误"
	case model.LogTypeRefund:
		return "退款"
	case model.LogTypeLogin:
		return "登录"
	default:
		return "未知"
	}
}

func logToRow(l *model.Log) []string {
	created := time.Unix(l.CreatedAt, 0).Format("2006-01-02 15:04:05")
	return []string{
		fmt.Sprintf("%d", l.Id),
		created,
		logTypeText(l.Type),
		l.Username,
		l.TokenName,
		l.ModelName,
		l.Group,
		fmt.Sprintf("%d", l.PromptTokens),
		fmt.Sprintf("%d", l.CompletionTokens),
		fmt.Sprintf("%d", l.Quota),
		fmt.Sprintf("%d", l.UseTime),
		l.ChannelName,
		l.Content,
	}
}

// fetchAllLogs 分批拉取所有日志（受 exportMaxRows 限制）。
func fetchAllLogs(fetch LogPageFetcher, progress func(done, total int)) ([]*model.Log, error) {
	var all []*model.Log
	startIdx := 0
	total := 0
	for {
		batch, t, err := fetch(startIdx, exportBatchSize)
		if err != nil {
			return nil, err
		}
		if startIdx == 0 {
			total = int(t)
			if total > exportMaxRows {
				total = exportMaxRows
			}
		}
		if len(batch) == 0 {
			break
		}
		all = append(all, batch...)
		startIdx += len(batch)
		if progress != nil {
			progress(len(all), total)
		}
		if len(batch) < exportBatchSize || len(all) >= exportMaxRows {
			break
		}
	}
	return all, nil
}

// buildXLSX 生成 Excel 字节流
func buildXLSX(logs []*model.Log) ([]byte, error) {
	f := excelize.NewFile()
	defer f.Close()
	sheet := "Logs"
	idx, err := f.NewSheet(sheet)
	if err != nil {
		return nil, err
	}
	f.SetActiveSheet(idx)
	f.DeleteSheet("Sheet1")

	// 表头
	for col, h := range logExportHeaders {
		cell, _ := excelize.CoordinatesToCellName(col+1, 1)
		_ = f.SetCellValue(sheet, cell, h)
	}
	// 数据行
	for r, l := range logs {
		row := logToRow(l)
		for col, v := range row {
			cell, _ := excelize.CoordinatesToCellName(col+1, r+2)
			_ = f.SetCellValue(sheet, cell, v)
		}
	}

	buf, err := f.WriteToBuffer()
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// cjkFontCandidates 返回候选 CJK 字体文件路径（按优先级）。
// 优先使用环境变量 PDF_CJK_FONT_PATH 指定的字体；否则尝试常见系统字体路径。
func cjkFontCandidates() []string {
	var candidates []string
	if p := os.Getenv("PDF_CJK_FONT_PATH"); p != "" {
		candidates = append(candidates, p)
	}
	candidates = append(candidates,
		// Linux 常见（Noto / 文泉驿 / 思源）
		"/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
		"/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
		"/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
		"/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
		"/usr/share/fonts/truetype/arphic/uming.ttc",
		"/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.otf",
		"/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc",
		// macOS
		"/System/Library/Fonts/PingFang.ttc",
		"/System/Library/Fonts/STHeiti Light.ttc",
		"/Library/Fonts/Arial Unicode.ttf",
		// Windows
		`C:\Windows\Fonts\msyh.ttf`,
		`C:\Windows\Fonts\simhei.ttf`,
		`C:\Windows\Fonts\simsun.ttc`,
		`C:\Windows\Fonts\simkai.ttf`,
		`C:\Windows\Fonts\STSONG.TTF`,
		`C:\Windows\Fonts\STKAITI.TTF`,
	)
	return candidates
}

// findCJKFont 返回第一个存在且可读的 CJK 字体文件路径；找不到返回空串。
// 仅支持 .ttf/.otf（gofpdf 的 AddUTF8FontFromBytes 不支持 .ttc 集合字体）。
func findCJKFont() string {
	for _, p := range cjkFontCandidates() {
		ext := strings.ToLower(filepath.Ext(p))
		if ext != ".ttf" && ext != ".otf" {
			continue
		}
		if data, err := os.ReadFile(p); err == nil && len(data) > 0 {
			return p
		}
	}
	return ""
}

// buildPDF 生成 PDF 字节流（横向 A4，简单表格）。
// 若能找到 CJK 字体则嵌入以正确显示中文；否则回退为 ASCII 安全输出（非 ASCII 以 ? 占位）。
func buildPDF(logs []*model.Log) ([]byte, error) {
	pdf := gofpdf.New("L", "mm", "A4", "")

	fontFamily := "Arial"
	cjkEnabled := false
	if fp := findCJKFont(); fp != "" {
		if data, err := os.ReadFile(fp); err == nil {
			pdf.AddUTF8FontFromBytes("CJK", "", data)
			fontFamily = "CJK"
			cjkEnabled = true
		}
	}

	pdf.SetFont(fontFamily, "", 7)
	pdf.AddPage()

	// 列宽（mm），适配横向 A4 可用宽度约 277mm
	widths := []float64{12, 30, 14, 22, 24, 30, 18, 18, 18, 16, 14, 22, 39}
	// 表头：启用 CJK 时用中文，否则用英文别名
	var headers []string
	if cjkEnabled {
		headers = []string{
			"ID", "时间", "类型", "用户", "令牌", "模型", "分组",
			"提示", "补全", "额度", "用时", "渠道", "详情",
		}
	} else {
		headers = []string{
			"ID", "Time", "Type", "User", "Token", "Model", "Group",
			"Prompt", "Completion", "Quota", "UseTime", "Channel", "Content",
		}
	}

	// AddUTF8Font 不支持 Bold 样式（未额外注册），统一使用常规字重
	headerStyle := "B"
	if cjkEnabled {
		headerStyle = ""
	}

	drawHeader := func() {
		pdf.SetFont(fontFamily, headerStyle, 7)
		for i, h := range headers {
			pdf.CellFormat(widths[i], 6, h, "1", 0, "C", false, 0, "")
		}
		pdf.Ln(-1)
		pdf.SetFont(fontFamily, "", 6)
	}
	drawHeader()

	// 仅 ASCII 安全输出（无 CJK 字体时使用），去除非 ASCII 字符避免乱码
	sanitize := func(s string) string {
		out := make([]rune, 0, len(s))
		for _, r := range s {
			if r < 128 {
				out = append(out, r)
			} else {
				out = append(out, '?')
			}
		}
		return string(out)
	}

	// 按字符（rune）截断，避免 CJK 多字节被截坏
	truncate := func(s string, n int) string {
		r := []rune(s)
		if len(r) > n {
			return string(r[:n])
		}
		return s
	}

	for _, l := range logs {
		row := logToRow(l)
		for i, v := range row {
			txt := v
			if cjkEnabled {
				txt = truncate(txt, 30)
			} else {
				txt = truncate(sanitize(txt), 40)
			}
			pdf.CellFormat(widths[i], 5, txt, "1", 0, "L", false, 0, "")
		}
		pdf.Ln(-1)
		if pdf.GetY() > 190 {
			pdf.AddPage()
			drawHeader()
		}
	}

	w := &bytesWriter{}
	if err := pdf.Output(w); err != nil {
		return nil, err
	}
	return w.data, nil
}

// bytesWriter 简单 io.Writer 收集字节
type bytesWriter struct {
	data []byte
}

func (b *bytesWriter) Write(p []byte) (int, error) {
	b.data = append(b.data, p...)
	return len(p), nil
}

// BuildLogExportBytes 同步生成导出文件字节流
func BuildLogExportBytes(logs []*model.Log, format LogExportFormat) ([]byte, error) {
	switch format {
	case LogExportFormatPDF:
		return buildPDF(logs)
	default:
		return buildXLSX(logs)
	}
}

// CountIsLarge 判断总量是否需要异步导出
func CountIsLarge(total int64) bool {
	return total > SyncExportThreshold
}

func exportDir() string {
	dir := filepath.Join(os.TempDir(), "newapi_log_exports")
	_ = os.MkdirAll(dir, 0o755)
	return dir
}

func exportFileName(format LogExportFormat) string {
	ts := time.Now().Format("20060102_150405")
	ext := "xlsx"
	if format == LogExportFormatPDF {
		ext = "pdf"
	}
	return fmt.Sprintf("logs_%s.%s", ts, ext)
}

// StartAsyncLogExport 创建并启动异步导出任务，返回任务。
func StartAsyncLogExport(userId int, format LogExportFormat, fetch LogPageFetcher) *LogExportJob {
	job := &LogExportJob{
		Id:        common.GetUUID(),
		UserId:    userId,
		Format:    format,
		Status:    LogExportStatusPending,
		FileName:  exportFileName(format),
		CreatedAt: time.Now().Unix(),
	}
	logExportJobsMu.Lock()
	logExportJobs[job.Id] = job
	logExportJobsMu.Unlock()

	go runExportJob(job, fetch)
	return job
}

func runExportJob(job *LogExportJob, fetch LogPageFetcher) {
	defer func() {
		if r := recover(); r != nil {
			setJobFailed(job.Id, fmt.Sprintf("export panic: %v", r))
		}
	}()

	updateJob(job.Id, func(j *LogExportJob) {
		j.Status = LogExportStatusRunning
	})

	logs, err := fetchAllLogs(fetch, func(done, total int) {
		updateJob(job.Id, func(j *LogExportJob) {
			j.Progress = done
			j.Total = total
		})
	})
	if err != nil {
		setJobFailed(job.Id, err.Error())
		return
	}

	data, err := BuildLogExportBytes(logs, job.Format)
	if err != nil {
		setJobFailed(job.Id, err.Error())
		return
	}

	path := filepath.Join(exportDir(), job.Id+"_"+job.FileName)
	if err := os.WriteFile(path, data, 0o600); err != nil {
		setJobFailed(job.Id, err.Error())
		return
	}

	updateJob(job.Id, func(j *LogExportJob) {
		j.Status = LogExportStatusDone
		j.FilePath = path
		j.Progress = len(logs)
		if j.Total == 0 {
			j.Total = len(logs)
		}
	})
}

func updateJob(id string, fn func(*LogExportJob)) {
	logExportJobsMu.Lock()
	defer logExportJobsMu.Unlock()
	if j, ok := logExportJobs[id]; ok {
		fn(j)
	}
}

func setJobFailed(id, msg string) {
	updateJob(id, func(j *LogExportJob) {
		j.Status = LogExportStatusFailed
		j.Error = msg
	})
}

// GetLogExportJob 返回任务副本
func GetLogExportJob(id string, userId int) (*LogExportJob, bool) {
	logExportJobsMu.RLock()
	defer logExportJobsMu.RUnlock()
	j, ok := logExportJobs[id]
	if !ok || j.UserId != userId {
		return nil, false
	}
	cp := *j
	return &cp, true
}

// ConsumeLogExportFile 返回已完成任务的文件路径，并从任务表移除（下载即删由调用方在发送后删除文件）。
func ConsumeLogExportFile(id string, userId int) (string, string, bool) {
	logExportJobsMu.Lock()
	defer logExportJobsMu.Unlock()
	j, ok := logExportJobs[id]
	if !ok || j.UserId != userId || j.Status != LogExportStatusDone {
		return "", "", false
	}
	path := j.FilePath
	name := j.FileName
	// 从任务表移除，文件由调用方发送后删除
	delete(logExportJobs, id)
	return path, name, true
}

// CleanupExpiredLogExports 兜底清理：删除超过 TTL 的任务与残留文件。
func CleanupExpiredLogExports() {
	now := time.Now().Unix()
	logExportJobsMu.Lock()
	defer logExportJobsMu.Unlock()
	for id, j := range logExportJobs {
		if now-j.CreatedAt > int64(exportFileTTL.Seconds()) {
			if j.FilePath != "" {
				_ = os.Remove(j.FilePath)
			}
			delete(logExportJobs, id)
		}
	}
}
