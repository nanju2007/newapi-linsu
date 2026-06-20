package controller

import (
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// buildLogExportFetcher 根据查询参数构造分页拉取函数。
// isAdmin 为 true 时走全量日志（可按 username 过滤），否则仅限当前用户。
func buildLogExportFetcher(c *gin.Context, isAdmin bool, userId int) service.LogPageFetcher {
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	group := c.Query("group")
	requestId := c.Query("request_id")
	upstreamRequestId := c.Query("upstream_request_id")
	if isAdmin {
		username := c.Query("username")
		channel, _ := strconv.Atoi(c.Query("channel"))
		return func(startIdx, num int) ([]*model.Log, int64, error) {
			return model.GetAllLogs(logType, startTimestamp, endTimestamp, modelName, username, tokenName, startIdx, num, channel, group, requestId, upstreamRequestId)
		}
	}
	return func(startIdx, num int) ([]*model.Log, int64, error) {
		return model.GetUserLogs(userId, logType, startTimestamp, endTimestamp, modelName, tokenName, startIdx, num, group, requestId, upstreamRequestId)
	}
}

func parseExportFormat(c *gin.Context) service.LogExportFormat {
	if c.Query("format") == "pdf" {
		return service.LogExportFormatPDF
	}
	return service.LogExportFormatXLSX
}

func sendExportFile(c *gin.Context, data []byte, format service.LogExportFormat) {
	name := "logs.xlsx"
	contentType := "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
	if format == service.LogExportFormatPDF {
		name = "logs.pdf"
		contentType = "application/pdf"
	}
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", name))
	c.Data(http.StatusOK, contentType, data)
}

// ExportLogs 导出日志：数据量小则同步直接返回文件；数据量大则创建异步任务返回任务信息。
func ExportLogs(c *gin.Context) {
	isAdmin := c.GetInt("role") >= common.RoleAdminUser
	userId := c.GetInt("id")
	format := parseExportFormat(c)
	fetch := buildLogExportFetcher(c, isAdmin, userId)

	// 先取一批以获得总数
	_, total, err := fetch(0, 1)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	if service.CountIsLarge(total) {
		job := service.StartAsyncLogExport(userId, format, fetch)
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "",
			"data": gin.H{
				"async":   true,
				"job_id":  job.Id,
				"total":   total,
				"message": "数据量较大，已转后台生成，请稍后下载",
			},
		})
		return
	}

	logs, _, err := fetchAllForSync(fetch)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	data, err := service.BuildLogExportBytes(logs, format)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	sendExportFile(c, data, format)
}

// fetchAllForSync 同步路径下拉取全部（受阈值限制，量不大）。
func fetchAllForSync(fetch service.LogPageFetcher) ([]*model.Log, int64, error) {
	var all []*model.Log
	startIdx := 0
	const batch = 1000
	var total int64
	for {
		logs, t, err := fetch(startIdx, batch)
		if err != nil {
			return nil, 0, err
		}
		if startIdx == 0 {
			total = t
		}
		if len(logs) == 0 {
			break
		}
		all = append(all, logs...)
		startIdx += len(logs)
		if len(logs) < batch || len(all) >= service.SyncExportThreshold {
			break
		}
	}
	return all, total, nil
}

// GetLogExportStatus 查询异步导出任务状态。
func GetLogExportStatus(c *gin.Context) {
	id := c.Query("job_id")
	userId := c.GetInt("id")
	job, ok := service.GetLogExportJob(id, userId)
	if !ok {
		common.ApiErrorMsg(c, "任务不存在或无权访问")
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    job,
	})
}

// DownloadLogExport 下载异步导出文件，发送完成后立即删除文件（一次性）。
func DownloadLogExport(c *gin.Context) {
	id := c.Query("job_id")
	userId := c.GetInt("id")
	path, name, ok := service.ConsumeLogExportFile(id, userId)
	if !ok {
		common.ApiErrorMsg(c, "文件不存在或尚未生成完成")
		return
	}
	// 发送后删除文件
	defer func() {
		_ = os.Remove(path)
	}()
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", url.PathEscape(name)))
	c.File(path)
}

func GetAllLogs(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	username := c.Query("username")
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	channel, _ := strconv.Atoi(c.Query("channel"))
	group := c.Query("group")
	requestId := c.Query("request_id")
	upstreamRequestId := c.Query("upstream_request_id")
	logs, total, err := model.GetAllLogs(logType, startTimestamp, endTimestamp, modelName, username, tokenName, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), channel, group, requestId, upstreamRequestId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(logs)
	common.ApiSuccess(c, pageInfo)
	return
}

func GetUserLogs(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	userId := c.GetInt("id")
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	group := c.Query("group")
	requestId := c.Query("request_id")
	upstreamRequestId := c.Query("upstream_request_id")
	logs, total, err := model.GetUserLogs(userId, logType, startTimestamp, endTimestamp, modelName, tokenName, pageInfo.GetStartIdx(), pageInfo.GetPageSize(), group, requestId, upstreamRequestId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(logs)
	common.ApiSuccess(c, pageInfo)
	return
}

// Deprecated: SearchAllLogs 已废弃，前端未使用该接口。
func SearchAllLogs(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": false,
		"message": "该接口已废弃",
	})
}

// Deprecated: SearchUserLogs 已废弃，前端未使用该接口。
func SearchUserLogs(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"success": false,
		"message": "该接口已废弃",
	})
}

func GetLogByKey(c *gin.Context) {
	tokenId := c.GetInt("token_id")
	if tokenId == 0 {
		c.JSON(200, gin.H{
			"success": false,
			"message": "无效的令牌",
		})
		return
	}
	logs, err := model.GetLogByTokenId(tokenId)
	if err != nil {
		c.JSON(200, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(200, gin.H{
		"success": true,
		"message": "",
		"data":    logs,
	})
}

func GetLogsStat(c *gin.Context) {
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	tokenName := c.Query("token_name")
	username := c.Query("username")
	modelName := c.Query("model_name")
	channel, _ := strconv.Atoi(c.Query("channel"))
	group := c.Query("group")
	stat, err := model.SumUsedQuota(logType, startTimestamp, endTimestamp, modelName, username, tokenName, channel, group)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	//tokenNum := model.SumUsedToken(logType, startTimestamp, endTimestamp, modelName, username, "")
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"quota": stat.Quota,
			"rpm":   stat.Rpm,
			"tpm":   stat.Tpm,
		},
	})
	return
}

func GetLogsSelfStat(c *gin.Context) {
	username := c.GetString("username")
	logType, _ := strconv.Atoi(c.Query("type"))
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	tokenName := c.Query("token_name")
	modelName := c.Query("model_name")
	channel, _ := strconv.Atoi(c.Query("channel"))
	group := c.Query("group")
	quotaNum, err := model.SumUsedQuota(logType, startTimestamp, endTimestamp, modelName, username, tokenName, channel, group)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	//tokenNum := model.SumUsedToken(logType, startTimestamp, endTimestamp, modelName, username, tokenName)
	c.JSON(200, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"quota": quotaNum.Quota,
			"rpm":   quotaNum.Rpm,
			"tpm":   quotaNum.Tpm,
			//"token": tokenNum,
		},
	})
	return
}

func DeleteHistoryLogs(c *gin.Context) {
	targetTimestamp, _ := strconv.ParseInt(c.Query("target_timestamp"), 10, 64)
	if targetTimestamp == 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "target timestamp is required",
		})
		return
	}
	count, err := model.DeleteOldLog(c.Request.Context(), targetTimestamp, 100)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    count,
	})
	return
}
