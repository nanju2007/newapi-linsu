package controller

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// ---- 帮助中心（用户侧：浏览/搜索已发布文档） ----

// GetHelpDocs 用户分页搜索已发布帮助文档。
func GetHelpDocs(c *gin.Context) {
	keyword := c.Query("keyword")
	category := c.Query("category")
	pageInfo := common.GetPageQuery(c)
	list, total, err := model.SearchHelpDocs(keyword, category, true, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(list)
	common.ApiSuccess(c, pageInfo)
}

// GetHelpDocDetail 用户查看已发布文档详情，并自增浏览量。
func GetHelpDocDetail(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "无效的文档ID")
		return
	}
	doc, err := model.GetHelpDocById(id, true)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	model.IncrHelpDocViews(id)
	common.ApiSuccess(c, doc)
}

// GetHelpCategories 返回已发布文档的分类列表。
func GetHelpCategories(c *gin.Context) {
	categories, err := model.GetHelpCategories(true)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, categories)
}

// ---- 帮助中心（管理员侧：CRUD） ----

// AdminGetHelpDocs 管理员分页搜索全部文档（含未发布）。
func AdminGetHelpDocs(c *gin.Context) {
	keyword := c.Query("keyword")
	category := c.Query("category")
	pageInfo := common.GetPageQuery(c)
	list, total, err := model.SearchHelpDocs(keyword, category, false, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(list)
	common.ApiSuccess(c, pageInfo)
}

// AdminGetHelpDocDetail 管理员查看文档详情（含未发布、不自增浏览量）。
func AdminGetHelpDocDetail(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "无效的文档ID")
		return
	}
	doc, err := model.GetHelpDocById(id, false)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, doc)
}

type HelpDocRequest struct {
	Title     string `json:"title"`
	Category  string `json:"category"`
	Content   string `json:"content"`
	Summary   string `json:"summary"`
	SortOrder int    `json:"sort_order"`
	Published *bool  `json:"published"`
}

// AdminCreateHelpDoc 管理员创建文档。
func AdminCreateHelpDoc(c *gin.Context) {
	var req HelpDocRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	published := true
	if req.Published != nil {
		published = *req.Published
	}
	doc := &model.HelpDoc{
		Title:     strings.TrimSpace(req.Title),
		Category:  strings.TrimSpace(req.Category),
		Content:   req.Content,
		Summary:   req.Summary,
		SortOrder: req.SortOrder,
		Published: published,
	}
	if err := model.CreateHelpDoc(doc); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, doc)
}

// AdminUpdateHelpDoc 管理员更新文档。
func AdminUpdateHelpDoc(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "无效的文档ID")
		return
	}
	var req HelpDocRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if strings.TrimSpace(req.Title) == "" {
		common.ApiErrorMsg(c, "标题不能为空")
		return
	}
	fields := map[string]interface{}{
		"title":      strings.TrimSpace(req.Title),
		"category":   strings.TrimSpace(req.Category),
		"content":    req.Content,
		"summary":    req.Summary,
		"sort_order": req.SortOrder,
	}
	if req.Published != nil {
		fields["published"] = *req.Published
	}
	if err := model.UpdateHelpDoc(id, fields); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// AdminDeleteHelpDoc 管理员删除文档。
func AdminDeleteHelpDoc(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "无效的文档ID")
		return
	}
	if err := model.DeleteHelpDoc(id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// ---- 图片上传（管理员，用于 Markdown 编辑器插图） ----

const helpUploadSubDir = "help"

var allowedImageExt = map[string]bool{
	".png": true, ".jpg": true, ".jpeg": true, ".gif": true,
	".webp": true, ".bmp": true, ".svg": true,
}

// helpUploadBaseDir 返回图片上传根目录（可由环境变量 UPLOAD_PATH 指定，默认 ./upload）。
func helpUploadBaseDir() string {
	base := os.Getenv("UPLOAD_PATH")
	if base == "" {
		base = "upload"
	}
	return filepath.Join(base, helpUploadSubDir)
}

func randomFileName(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return fmt.Sprintf("%d", common.GetTimestamp())
	}
	return hex.EncodeToString(b)
}

// AdminUploadHelpImage 接收图片并保存到本地上传目录，返回可访问 URL。
func AdminUploadHelpImage(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		common.ApiErrorMsg(c, "未接收到上传文件")
		return
	}
	// 限制 10MB
	if file.Size > 10*1024*1024 {
		common.ApiErrorMsg(c, "图片大小不能超过 10MB")
		return
	}
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !allowedImageExt[ext] {
		common.ApiErrorMsg(c, "不支持的图片格式")
		return
	}

	dir := helpUploadBaseDir()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		common.ApiErrorMsg(c, "创建上传目录失败")
		return
	}
	name := fmt.Sprintf("%d_%s%s", common.GetTimestamp(), randomFileName(8), ext)
	dst := filepath.Join(dir, name)
	if err := c.SaveUploadedFile(file, dst); err != nil {
		common.ApiErrorMsg(c, "保存文件失败")
		return
	}

	url := "/upload/" + helpUploadSubDir + "/" + name
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"url":  url,
			"name": file.Filename,
		},
	})
}
