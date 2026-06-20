package model

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"gorm.io/gorm"
)

// 提现状态
const (
	WithdrawalStatusPending  = "pending"  // 待审核
	WithdrawalStatusApproved = "approved" // 已通过（已打款）
	WithdrawalStatusRejected = "rejected" // 已拒绝（额度已退回）
)

// Withdrawal 邀请返利提现申请。
// 用户将邀请额度（AffQuota）发起提现，提交时即冻结对应额度（从 AffQuota 扣除），
// 管理员审核通过表示已线下打款；拒绝则将冻结额度退回用户 AffQuota。
type Withdrawal struct {
	Id            int     `json:"id"`
	UserId        int     `json:"user_id" gorm:"index"`
	Username      string  `json:"username" gorm:"type:varchar(64);index"`
	Quota         int     `json:"quota"`                                 // 提现的额度（内部单位）
	Amount        float64 `json:"amount"`                                // 折算后的金额（按 QuotaPerUnit 换算的美元数）
	AccountType   string  `json:"account_type" gorm:"type:varchar(32)"`  // 收款方式：alipay / wechat / bank / usdt 等
	AccountInfo   string  `json:"account_info" gorm:"type:varchar(255)"` // 收款账号信息
	RealName      string  `json:"real_name" gorm:"type:varchar(64)"`     // 收款人姓名
	Status        string  `json:"status" gorm:"type:varchar(20);index;default:'pending'"`
	Comment       string  `json:"comment" gorm:"type:varchar(512)"`       // 用户备注
	AdminComment  string  `json:"admin_comment" gorm:"type:varchar(512)"` // 管理员处理备注
	CreatedTime   int64   `json:"created_time" gorm:"bigint"`
	ProcessedTime int64   `json:"processed_time" gorm:"bigint"`
	ProcessedBy   int     `json:"processed_by"` // 处理的管理员用户ID
}

// CreateWithdrawal 创建提现申请，并在同一事务中冻结用户的邀请额度。
func CreateWithdrawal(userId int, quota int, accountType, accountInfo, realName, comment string) (*Withdrawal, error) {
	if quota <= 0 {
		return nil, errors.New("提现额度必须大于 0")
	}
	if accountInfo == "" {
		return nil, errors.New("请填写收款账号信息")
	}

	var withdrawal *Withdrawal
	err := DB.Transaction(func(tx *gorm.DB) error {
		var user User
		if err := tx.Set("gorm:query_option", "FOR UPDATE").First(&user, "id = ?", userId).Error; err != nil {
			return errors.New("用户不存在")
		}
		if user.AffQuota < quota {
			return errors.New("可提现的邀请额度不足")
		}

		// 冻结额度：从 AffQuota 扣除（拒绝时退回）
		if err := tx.Model(&User{}).Where("id = ?", userId).
			Update("aff_quota", gorm.Expr("aff_quota - ?", quota)).Error; err != nil {
			return err
		}

		amount := float64(quota) / common.QuotaPerUnit
		withdrawal = &Withdrawal{
			UserId:      userId,
			Username:    user.Username,
			Quota:       quota,
			Amount:      amount,
			AccountType: accountType,
			AccountInfo: accountInfo,
			RealName:    realName,
			Status:      WithdrawalStatusPending,
			Comment:     comment,
			CreatedTime: common.GetTimestamp(),
		}
		return tx.Create(withdrawal).Error
	})
	if err != nil {
		return nil, err
	}

	RecordLog(userId, LogTypeManage, fmt.Sprintf("发起邀请返利提现，冻结邀请额度 %s", logger.LogQuota(quota)))
	return withdrawal, nil
}

// ApproveWithdrawal 管理员审核通过提现（视为已线下打款，冻结额度不退回）。
func ApproveWithdrawal(id int, adminId int, adminComment string) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var w Withdrawal
		if err := tx.Set("gorm:query_option", "FOR UPDATE").First(&w, "id = ?", id).Error; err != nil {
			return errors.New("提现申请不存在")
		}
		if w.Status != WithdrawalStatusPending {
			return errors.New("该提现申请已处理")
		}
		w.Status = WithdrawalStatusApproved
		w.AdminComment = adminComment
		w.ProcessedBy = adminId
		w.ProcessedTime = common.GetTimestamp()
		if err := tx.Save(&w).Error; err != nil {
			return err
		}
		RecordLog(w.UserId, LogTypeManage, fmt.Sprintf("邀请返利提现申请已通过，提现额度 %s", logger.LogQuota(w.Quota)))
		return nil
	})
}

// RejectWithdrawal 管理员拒绝提现，将冻结的邀请额度退回用户。
func RejectWithdrawal(id int, adminId int, adminComment string) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		var w Withdrawal
		if err := tx.Set("gorm:query_option", "FOR UPDATE").First(&w, "id = ?", id).Error; err != nil {
			return errors.New("提现申请不存在")
		}
		if w.Status != WithdrawalStatusPending {
			return errors.New("该提现申请已处理")
		}
		// 退回冻结的邀请额度
		if err := tx.Model(&User{}).Where("id = ?", w.UserId).
			Update("aff_quota", gorm.Expr("aff_quota + ?", w.Quota)).Error; err != nil {
			return err
		}
		w.Status = WithdrawalStatusRejected
		w.AdminComment = adminComment
		w.ProcessedBy = adminId
		w.ProcessedTime = common.GetTimestamp()
		if err := tx.Save(&w).Error; err != nil {
			return err
		}
		RecordLog(w.UserId, LogTypeManage, fmt.Sprintf("邀请返利提现申请已拒绝，退回邀请额度 %s", logger.LogQuota(w.Quota)))
		return nil
	})
}

// GetUserWithdrawals 获取某用户的提现记录（分页）。
func GetUserWithdrawals(userId int, startIdx int, num int) ([]*Withdrawal, int64, error) {
	var list []*Withdrawal
	var total int64
	if err := DB.Model(&Withdrawal{}).Where("user_id = ?", userId).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := DB.Where("user_id = ?", userId).Order("id desc").Limit(num).Offset(startIdx).Find(&list).Error
	return list, total, err
}

// GetAllWithdrawals 管理员获取全部提现记录（可按状态过滤，分页）。
func GetAllWithdrawals(status string, startIdx int, num int) ([]*Withdrawal, int64, error) {
	var list []*Withdrawal
	var total int64
	query := DB.Model(&Withdrawal{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Order("id desc").Limit(num).Offset(startIdx).Find(&list).Error
	return list, total, err
}

// GetWithdrawalById 按 ID 获取提现记录。
func GetWithdrawalById(id int) (*Withdrawal, error) {
	var w Withdrawal
	if err := DB.First(&w, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &w, nil
}
