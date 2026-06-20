package middleware

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/url"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

const geetestValidateURL = "https://gcaptcha4.geetest.com/validate"

type geetestValidateResponse struct {
	Result string `json:"result"`
	Reason string `json:"reason"`
}

// GeetestCheck 极验行为验证 4.0 服务端二次校验中间件。
// 客户端在验证成功后通过 query 参数传入 lot_number / captcha_output / pass_token / gen_time。
func GeetestCheck() gin.HandlerFunc {
	return func(c *gin.Context) {
		if !common.GeetestEnabled {
			c.Next()
			return
		}

		session := sessions.Default(c)
		if checked := session.Get("geetest"); checked != nil {
			c.Next()
			return
		}

		lotNumber := c.Query("lot_number")
		captchaOutput := c.Query("captcha_output")
		passToken := c.Query("pass_token")
		genTime := c.Query("gen_time")

		if lotNumber == "" || captchaOutput == "" || passToken == "" || genTime == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "极验校验参数为空，请完成验证后重试！",
			})
			c.Abort()
			return
		}

		// 生成 sign_token：以极验 KEY 作为密钥，对 lot_number 进行 HMAC-SHA256 摘要
		mac := hmac.New(sha256.New, []byte(common.GeetestKey))
		mac.Write([]byte(lotNumber))
		signToken := hex.EncodeToString(mac.Sum(nil))

		client := &http.Client{Timeout: 5 * time.Second}
		rawRes, err := client.PostForm(geetestValidateURL, url.Values{
			"lot_number":     {lotNumber},
			"captcha_output": {captchaOutput},
			"pass_token":     {passToken},
			"gen_time":       {genTime},
			"sign_token":     {signToken},
			"captcha_id":     {common.GeetestId},
		})
		if err != nil {
			// 极验官方建议：服务端校验接口异常时按宕机模式放行，避免阻断正常用户
			common.SysLog("极验校验请求失败，按宕机模式放行：" + err.Error())
			markGeetestPassed(c, session)
			c.Next()
			return
		}
		defer rawRes.Body.Close()

		var res geetestValidateResponse
		if err = common.DecodeJson(rawRes.Body, &res); err != nil {
			common.SysLog("极验校验响应解析失败，按宕机模式放行：" + err.Error())
			markGeetestPassed(c, session)
			c.Next()
			return
		}

		if res.Result != "success" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "极验校验失败，请刷新重试！",
			})
			c.Abort()
			return
		}

		markGeetestPassed(c, session)
		c.Next()
	}
}

func markGeetestPassed(c *gin.Context, session sessions.Session) {
	session.Set("geetest", true)
	if err := session.Save(); err != nil {
		common.SysLog("保存极验会话信息失败：" + err.Error())
	}
}
