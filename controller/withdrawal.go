package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// CreateWithdrawalRequest 用户发起提现申请的请求体。
type CreateWithdrawalRequest struct {
	Quota       int    `json:"quota" binding:"required"`
	AccountType string `json:"account_type"`
	AccountInfo string `json:"account_info" binding:"required"`
	RealName    string `json:"real_name"`
	Comment     string `json:"comment"`
}

// CreateWithdrawal 用户发起邀请返利提现申请。
func CreateWithdrawal(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}
	userId := c.GetInt("id")
	var req CreateWithdrawalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	w, err := model.CreateWithdrawal(userId, req.Quota, req.AccountType, req.AccountInfo, req.RealName, req.Comment)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, w)
}

// GetUserWithdrawals 用户查看自己的提现记录（分页）。
func GetUserWithdrawals(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)
	list, total, err := model.GetUserWithdrawals(userId, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(list)
	common.ApiSuccess(c, pageInfo)
}

// GetAllWithdrawals 管理员查看全部提现记录（可按状态过滤，分页）。
func GetAllWithdrawals(c *gin.Context) {
	status := c.Query("status")
	pageInfo := common.GetPageQuery(c)
	list, total, err := model.GetAllWithdrawals(status, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(list)
	common.ApiSuccess(c, pageInfo)
}

// ProcessWithdrawalRequest 管理员处理提现的请求体。
type ProcessWithdrawalRequest struct {
	Id           int    `json:"id" binding:"required"`
	AdminComment string `json:"admin_comment"`
}

// ApproveWithdrawal 管理员审核通过提现申请。
func ApproveWithdrawal(c *gin.Context) {
	adminId := c.GetInt("id")
	var req ProcessWithdrawalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.ApproveWithdrawal(req.Id, adminId, req.AdminComment); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, nil)
}

// RejectWithdrawal 管理员拒绝提现申请（退回冻结额度）。
func RejectWithdrawal(c *gin.Context) {
	adminId := c.GetInt("id")
	var req ProcessWithdrawalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.RejectWithdrawal(req.Id, adminId, req.AdminComment); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, nil)
}
