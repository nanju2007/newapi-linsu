package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

// 工单状态
const (
	TicketStatusOpen    = "open"    // 待处理
	TicketStatusReplied = "replied" // 已回复
	TicketStatusClosed  = "closed"  // 已关闭
)

// Ticket 工单。用户提交问题，管理员回复处理。
type Ticket struct {
	Id          int    `json:"id"`
	UserId      int    `json:"user_id" gorm:"index"`
	Username    string `json:"username" gorm:"type:varchar(64);index"`
	Title       string `json:"title" gorm:"type:varchar(255)"`
	Category    string `json:"category" gorm:"type:varchar(32)"` // 工单分类：general / billing / technical 等
	Status      string `json:"status" gorm:"type:varchar(20);index;default:'open'"`
	CreatedTime int64  `json:"created_time" gorm:"bigint"`
	UpdatedTime int64  `json:"updated_time" gorm:"bigint"`
	// Messages 关联的工单消息（非数据库列），按需加载。
	Messages []TicketMessage `json:"messages,omitempty" gorm:"-"`
}

// TicketMessage 工单消息（对话记录）。
type TicketMessage struct {
	Id          int    `json:"id"`
	TicketId    int    `json:"ticket_id" gorm:"index"`
	UserId      int    `json:"user_id"`
	IsAdmin     bool   `json:"is_admin"` // 是否管理员回复
	Content     string `json:"content" gorm:"type:text"`
	CreatedTime int64  `json:"created_time" gorm:"bigint"`
}

// CreateTicket 用户创建工单，并写入首条消息。
func CreateTicket(userId int, username, title, category, content string) (*Ticket, error) {
	if title == "" {
		return nil, errors.New("请填写工单标题")
	}
	if content == "" {
		return nil, errors.New("请填写工单内容")
	}

	var ticket *Ticket
	err := DB.Transaction(func(tx *gorm.DB) error {
		now := common.GetTimestamp()
		ticket = &Ticket{
			UserId:      userId,
			Username:    username,
			Title:       title,
			Category:    category,
			Status:      TicketStatusOpen,
			CreatedTime: now,
			UpdatedTime: now,
		}
		if err := tx.Create(ticket).Error; err != nil {
			return err
		}
		msg := &TicketMessage{
			TicketId:    ticket.Id,
			UserId:      userId,
			IsAdmin:     false,
			Content:     content,
			CreatedTime: now,
		}
		return tx.Create(msg).Error
	})
	if err != nil {
		return nil, err
	}
	return ticket, nil
}

// ReplyTicket 向工单追加一条消息。isAdmin 标识是否管理员回复。
// 用户回复后状态置为 open（待处理）；管理员回复后状态置为 replied（已回复）。
func ReplyTicket(ticketId, userId int, isAdmin bool, content string) error {
	if content == "" {
		return errors.New("回复内容不能为空")
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		var ticket Ticket
		if err := tx.Set("gorm:query_option", "FOR UPDATE").First(&ticket, "id = ?", ticketId).Error; err != nil {
			return errors.New("工单不存在")
		}
		if ticket.Status == TicketStatusClosed {
			return errors.New("工单已关闭，无法回复")
		}
		// 非管理员只能回复自己的工单
		if !isAdmin && ticket.UserId != userId {
			return errors.New("无权回复该工单")
		}
		now := common.GetTimestamp()
		msg := &TicketMessage{
			TicketId:    ticketId,
			UserId:      userId,
			IsAdmin:     isAdmin,
			Content:     content,
			CreatedTime: now,
		}
		if err := tx.Create(msg).Error; err != nil {
			return err
		}
		newStatus := TicketStatusOpen
		if isAdmin {
			newStatus = TicketStatusReplied
		}
		return tx.Model(&Ticket{}).Where("id = ?", ticketId).
			Updates(map[string]interface{}{"status": newStatus, "updated_time": now}).Error
	})
}

// CloseTicket 关闭工单。用户可关闭自己的工单，管理员可关闭任意工单。
func CloseTicket(ticketId, userId int, isAdmin bool) error {
	var ticket Ticket
	if err := DB.First(&ticket, "id = ?", ticketId).Error; err != nil {
		return errors.New("工单不存在")
	}
	if !isAdmin && ticket.UserId != userId {
		return errors.New("无权关闭该工单")
	}
	return DB.Model(&Ticket{}).Where("id = ?", ticketId).
		Updates(map[string]interface{}{"status": TicketStatusClosed, "updated_time": common.GetTimestamp()}).Error
}

// GetTicketWithMessages 获取工单及其消息。非管理员只能查看自己的工单。
func GetTicketWithMessages(ticketId, userId int, isAdmin bool) (*Ticket, error) {
	var ticket Ticket
	if err := DB.First(&ticket, "id = ?", ticketId).Error; err != nil {
		return nil, errors.New("工单不存在")
	}
	if !isAdmin && ticket.UserId != userId {
		return nil, errors.New("无权查看该工单")
	}
	var messages []TicketMessage
	if err := DB.Where("ticket_id = ?", ticketId).Order("id asc").Find(&messages).Error; err != nil {
		return nil, err
	}
	ticket.Messages = messages
	return &ticket, nil
}

// GetUserTickets 获取某用户的工单列表（分页）。
func GetUserTickets(userId int, startIdx, num int) ([]*Ticket, int64, error) {
	var list []*Ticket
	var total int64
	if err := DB.Model(&Ticket{}).Where("user_id = ?", userId).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := DB.Where("user_id = ?", userId).Order("updated_time desc").
		Limit(num).Offset(startIdx).Find(&list).Error
	return list, total, err
}

// GetAllTickets 管理员获取全部工单（可按状态过滤，分页）。
func GetAllTickets(status string, startIdx, num int) ([]*Ticket, int64, error) {
	var list []*Ticket
	var total int64
	query := DB.Model(&Ticket{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Order("updated_time desc").Limit(num).Offset(startIdx).Find(&list).Error
	return list, total, err
}
