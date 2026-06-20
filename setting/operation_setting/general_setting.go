package operation_setting

import "github.com/QuantumNous/new-api/setting/config"

// 额度展示类型
const (
	QuotaDisplayTypeUSD    = "USD"
	QuotaDisplayTypeCNY    = "CNY"
	QuotaDisplayTypeTokens = "TOKENS"
	QuotaDisplayTypeCustom = "CUSTOM"
)

type GeneralSetting struct {
	DocsLink            string `json:"docs_link"`
	PingIntervalEnabled bool   `json:"ping_interval_enabled"`
	PingIntervalSeconds int    `json:"ping_interval_seconds"`
	// 当前站点额度展示类型：USD / CNY / TOKENS
	QuotaDisplayType string `json:"quota_display_type"`
	// 自定义货币符号，用于 CUSTOM 展示类型
	CustomCurrencySymbol string `json:"custom_currency_symbol"`
	// 自定义货币与美元汇率（1 USD = X Custom）
	CustomCurrencyExchangeRate float64 `json:"custom_currency_exchange_rate"`

	// ThemePreset 站点主题预设色调名称（default/blue/violet/teal/green/rose/amber/warm）。
	// default 表示 newapi 默认白色 + 蓝色强调。
	ThemePreset string `json:"theme_preset"`
	// ThemePrimaryColor 管理员自定义主色调（HEX，如 #2563eb）。
	// 非空时覆盖预设主色，前端据此注入 --semi-color-primary 系列变量。
	ThemePrimaryColor string `json:"theme_primary_color"`

	// StreamDrainOnClientGoneEnabled 客户端在流式传输过程中主动断开后，
	// 是否继续读取上游剩余数据以正确统计 usage 并完成计费。
	// 关闭时维持旧行为：客户端断开即切断上游连接（可能导致 usage 为 0、计费缺失）。
	StreamDrainOnClientGoneEnabled bool `json:"stream_drain_on_client_gone_enabled"`
	// StreamDrainOnClientGoneTimeoutMs 客户端断开后继续读取上游的最长等待时间（毫秒），
	// 0 表示沿用 STREAMING_TIMEOUT。用于防止上游 hang 住时长时间占用连接。
	StreamDrainOnClientGoneTimeoutMs int `json:"stream_drain_on_client_gone_timeout_ms"`
}

// 默认配置
var generalSetting = GeneralSetting{
	DocsLink:                         "https://docs.newapi.pro",
	PingIntervalEnabled:              false,
	PingIntervalSeconds:              60,
	QuotaDisplayType:                 QuotaDisplayTypeUSD,
	CustomCurrencySymbol:             "¤",
	CustomCurrencyExchangeRate:       1.0,
	ThemePreset:                      "default",
	ThemePrimaryColor:                "",
	StreamDrainOnClientGoneEnabled:   true,
	StreamDrainOnClientGoneTimeoutMs: 0,
}

func init() {
	// 注册到全局配置管理器
	config.GlobalConfig.Register("general_setting", &generalSetting)
}

func GetGeneralSetting() *GeneralSetting {
	return &generalSetting
}

// IsCurrencyDisplay 是否以货币形式展示（美元或人民币）
func IsCurrencyDisplay() bool {
	return generalSetting.QuotaDisplayType != QuotaDisplayTypeTokens
}

// IsCNYDisplay 是否以人民币展示
func IsCNYDisplay() bool {
	return generalSetting.QuotaDisplayType == QuotaDisplayTypeCNY
}

// GetQuotaDisplayType 返回额度展示类型
func GetQuotaDisplayType() string {
	return generalSetting.QuotaDisplayType
}

// GetCurrencySymbol 返回当前展示类型对应符号
func GetCurrencySymbol() string {
	switch generalSetting.QuotaDisplayType {
	case QuotaDisplayTypeUSD:
		return "$"
	case QuotaDisplayTypeCNY:
		return "¥"
	case QuotaDisplayTypeCustom:
		if generalSetting.CustomCurrencySymbol != "" {
			return generalSetting.CustomCurrencySymbol
		}
		return "¤"
	default:
		return ""
	}
}

// GetUsdToCurrencyRate 返回 1 USD = X <currency> 的 X（TOKENS 不适用）
func GetUsdToCurrencyRate(usdToCny float64) float64 {
	switch generalSetting.QuotaDisplayType {
	case QuotaDisplayTypeUSD:
		return 1
	case QuotaDisplayTypeCNY:
		return usdToCny
	case QuotaDisplayTypeCustom:
		if generalSetting.CustomCurrencyExchangeRate > 0 {
			return generalSetting.CustomCurrencyExchangeRate
		}
		return 1
	default:
		return 1
	}
}
