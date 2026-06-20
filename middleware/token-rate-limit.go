package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
)

// 令牌级 / 套餐级 每分钟请求次数（RPM）限流。
//
// 与系统级「模型请求速率限制」(ModelRequestRateLimit) 复用相同的存储选择策略：
//   - 启用 Redis 时使用 Redis 滑动窗口；
//   - 否则使用内存滑动窗口（单实例）。
//
// 该中间件必须在 TokenAuth 之后执行（依赖 token_id / token_rpm_limit /
// token_subscription_id 等上下文）。窗口固定为 60 秒。

const (
	tokenRpmMark        = "TRPM"
	subscriptionRpmMark = "SRPM"
	rpmWindowSeconds    = int64(60)
)

// checkRpmRedis 使用 Redis 列表实现 60 秒滑动窗口限流，返回是否允许。
// 与 model-rate-limit.go 中的实现保持一致的时间格式与窗口判断。
func checkRpmRedis(ctx context.Context, rdb *redis.Client, key string, maxCount int) (bool, error) {
	if maxCount <= 0 {
		return true, nil
	}
	length, err := rdb.LLen(ctx, key).Result()
	if err != nil {
		return false, err
	}
	if length < int64(maxCount) {
		return true, nil
	}
	oldTimeStr, _ := rdb.LIndex(ctx, key, -1).Result()
	oldTime, err := time.Parse(timeFormat, oldTimeStr)
	if err != nil {
		return false, err
	}
	nowTime := time.Now()
	if int64(nowTime.Sub(oldTime).Seconds()) < rpmWindowSeconds {
		rdb.Expire(ctx, key, time.Duration(rpmWindowSeconds)*time.Second)
		return false, nil
	}
	return true, nil
}

func recordRpmRedis(ctx context.Context, rdb *redis.Client, key string, maxCount int) {
	if maxCount <= 0 {
		return
	}
	now := time.Now().Format(timeFormat)
	rdb.LPush(ctx, key, now)
	rdb.LTrim(ctx, key, 0, int64(maxCount-1))
	rdb.Expire(ctx, key, time.Duration(rpmWindowSeconds)*time.Second)
}

// enforceRpm 检查并记录一次请求，返回是否允许。
func enforceRpm(c *gin.Context, key string, maxCount int) bool {
	if maxCount <= 0 {
		return true
	}
	if common.RedisEnabled && common.RDB != nil {
		ctx := context.Background()
		allowed, err := checkRpmRedis(ctx, common.RDB, key, maxCount)
		if err != nil {
			// Redis 异常时放行，避免因限流组件故障阻断正常业务
			return true
		}
		if !allowed {
			return false
		}
		recordRpmRedis(ctx, common.RDB, key, maxCount)
		return true
	}
	// 内存滑动窗口
	inMemoryRateLimiter.Init(time.Duration(rpmWindowSeconds) * time.Second)
	return inMemoryRateLimiter.Request(key, maxCount, rpmWindowSeconds)
}

// TokenRateLimit 令牌级与套餐级 RPM 限流中间件。
func TokenRateLimit() func(c *gin.Context) {
	return func(c *gin.Context) {
		// 1. 令牌 RPM
		tokenRpm := common.GetContextKeyInt(c, constant.ContextKeyTokenRpmLimit)
		if tokenRpm > 0 {
			tokenId := c.GetInt("token_id")
			key := fmt.Sprintf("rateLimit:%s:%d", tokenRpmMark, tokenId)
			if !common.RedisEnabled || common.RDB == nil {
				key = tokenRpmMark + strconv.Itoa(tokenId)
			}
			if !enforceRpm(c, key, tokenRpm) {
				abortWithOpenAiMessage(c, http.StatusTooManyRequests,
					fmt.Sprintf("您已达到令牌每分钟请求次数限制：%d 次/分钟", tokenRpm))
				return
			}
		}

		// 2. 套餐 RPM（仅当令牌绑定了订阅，且订阅套餐启用 RPM 时）
		subId := common.GetContextKeyInt(c, constant.ContextKeyTokenSubscriptionId)
		if subId > 0 {
			info, err := model.GetSubscriptionPlanInfoByUserSubscriptionId(subId)
			if err == nil && info != nil && info.RpmEnabled && info.RpmLimit > 0 {
				key := fmt.Sprintf("rateLimit:%s:%d", subscriptionRpmMark, subId)
				if !common.RedisEnabled || common.RDB == nil {
					key = subscriptionRpmMark + strconv.Itoa(subId)
				}
				if !enforceRpm(c, key, info.RpmLimit) {
					abortWithOpenAiMessage(c, http.StatusTooManyRequests,
						fmt.Sprintf("您已达到套餐每分钟请求次数限制：%d 次/分钟", info.RpmLimit))
					return
				}
			}
		}

		c.Next()
	}
}
