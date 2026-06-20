package model

import (
	"errors"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// HelpDoc 帮助中心文档。管理员可增删改，普通用户可浏览/搜索已发布文档。
type HelpDoc struct {
	Id          int    `json:"id"`
	Title       string `json:"title" gorm:"type:varchar(255);index"`
	Category    string `json:"category" gorm:"type:varchar(64);index;default:''"`
	Content     string `json:"content" gorm:"type:text"` // Markdown 正文
	Summary     string `json:"summary" gorm:"type:varchar(512);default:''"`
	SortOrder   int    `json:"sort_order" gorm:"default:0"`
	Published   bool   `json:"published" gorm:"index;default:true"`
	Views       int    `json:"views" gorm:"default:0"`
	CreatedTime int64  `json:"created_time" gorm:"bigint"`
	UpdatedTime int64  `json:"updated_time" gorm:"bigint"`
}

// CreateHelpDoc 创建帮助文档。
func CreateHelpDoc(doc *HelpDoc) error {
	if strings.TrimSpace(doc.Title) == "" {
		return errors.New("标题不能为空")
	}
	now := common.GetTimestamp()
	doc.CreatedTime = now
	doc.UpdatedTime = now
	return DB.Create(doc).Error
}

// UpdateHelpDoc 更新帮助文档（允许更新零值字段）。
func UpdateHelpDoc(id int, fields map[string]interface{}) error {
	if id <= 0 {
		return errors.New("无效的文档ID")
	}
	fields["updated_time"] = common.GetTimestamp()
	return DB.Model(&HelpDoc{}).Where("id = ?", id).Updates(fields).Error
}

// DeleteHelpDoc 删除帮助文档。
func DeleteHelpDoc(id int) error {
	if id <= 0 {
		return errors.New("无效的文档ID")
	}
	return DB.Delete(&HelpDoc{}, "id = ?", id).Error
}

// GetHelpDocById 按 ID 获取文档。onlyPublished 为 true 时仅返回已发布文档。
func GetHelpDocById(id int, onlyPublished bool) (*HelpDoc, error) {
	var doc HelpDoc
	query := DB.Where("id = ?", id)
	if onlyPublished {
		query = query.Where("published = ?", true)
	}
	if err := query.First(&doc).Error; err != nil {
		return nil, errors.New("文档不存在")
	}
	return &doc, nil
}

// IncrHelpDocViews 浏览量 +1（忽略错误，best-effort）。
func IncrHelpDocViews(id int) {
	_ = DB.Model(&HelpDoc{}).Where("id = ?", id).
		UpdateColumn("views", gorm.Expr("views + ?", 1)).Error
}

// helpDocSearchQuery 构造关键字/分类过滤查询。
func helpDocSearchQuery(keyword, category string, onlyPublished bool) *gorm.DB {
	query := DB.Model(&HelpDoc{})
	if onlyPublished {
		query = query.Where("published = ?", true)
	}
	if category != "" {
		query = query.Where("category = ?", category)
	}
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("title LIKE ? OR summary LIKE ? OR content LIKE ?", like, like, like)
	}
	return query
}

// SearchHelpDocs 分页搜索帮助文档。
func SearchHelpDocs(keyword, category string, onlyPublished bool, startIdx, num int) ([]*HelpDoc, int64, error) {
	var list []*HelpDoc
	var total int64
	query := helpDocSearchQuery(keyword, category, onlyPublished)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	// 列表不返回大字段 content，降低传输量
	err := query.Select("id", "title", "category", "summary", "sort_order", "published", "views", "created_time", "updated_time").
		Order("sort_order asc, updated_time desc").
		Limit(num).Offset(startIdx).Find(&list).Error
	return list, total, err
}

// GetHelpCategories 返回已发布文档的全部分类（去重、非空）。
func GetHelpCategories(onlyPublished bool) ([]string, error) {
	var categories []string
	query := DB.Model(&HelpDoc{}).Distinct("category")
	if onlyPublished {
		query = query.Where("published = ?", true)
	}
	if err := query.Where("category <> ''").Order("category asc").Pluck("category", &categories).Error; err != nil {
		return nil, err
	}
	return categories, nil
}
