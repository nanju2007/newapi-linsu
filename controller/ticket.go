package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// CreateTicketRequest 用户创建工单的请求体。
type CreateTicketRequest struct {
	Title    string `json:"title" binding:"required"`
	Category string `json:"category"`
	Content  string `json:"content" binding:"required"`
}

// CreateTicket 用户创建工单。
func CreateTicket(c *gin.Context) {
	userId := c.GetInt("id")
	username := c.GetString("username")
	var req CreateTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	ticket, err := model.CreateTicket(userId, username, req.Title, req.Category, req.Content)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, ticket)
}

// GetUserTickets 用户查看自己的工单列表。
func GetUserTickets(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)
	list, total, err := model.GetUserTickets(userId, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(list)
	common.ApiSuccess(c, pageInfo)
}

// GetTicketDetail 查看工单详情（含消息）。非管理员只能查看自己的工单。
func GetTicketDetail(c *gin.Context) {
	userId := c.GetInt("id")
	isAdmin := c.GetInt("role") >= common.RoleAdminUser
	ticketId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "无效的工单ID")
		return
	}
	ticket, err := model.GetTicketWithMessages(ticketId, userId, isAdmin)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, ticket)
}

// ReplyTicketRequest 工单回复请求体。
type ReplyTicketRequest struct {
	Content string `json:"content" binding:"required"`
}

// ReplyTicket 用户回复自己的工单。
func ReplyTicket(c *gin.Context) {
	userId := c.GetInt("id")
	ticketId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "无效的工单ID")
		return
	}
	var req ReplyTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.ReplyTicket(ticketId, userId, false, req.Content); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, nil)
}

// CloseTicket 用户关闭自己的工单。
func CloseTicket(c *gin.Context) {
	userId := c.GetInt("id")
	ticketId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "无效的工单ID")
		return
	}
	if err := model.CloseTicket(ticketId, userId, false); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, nil)
}

// GetAllTickets 管理员获取全部工单（可按状态过滤）。
func GetAllTickets(c *gin.Context) {
	status := c.Query("status")
	pageInfo := common.GetPageQuery(c)
	list, total, err := model.GetAllTickets(status, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(list)
	common.ApiSuccess(c, pageInfo)
}

// AdminReplyTicket 管理员回复工单。
func AdminReplyTicket(c *gin.Context) {
	adminId := c.GetInt("id")
	ticketId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "无效的工单ID")
		return
	}
	var req ReplyTicketRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.ReplyTicket(ticketId, adminId, true, req.Content); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, nil)
}

// AdminCloseTicket 管理员关闭工单。
func AdminCloseTicket(c *gin.Context) {
	adminId := c.GetInt("id")
	ticketId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "无效的工单ID")
		return
	}
	if err := model.CloseTicket(ticketId, adminId, true); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, nil)
}
