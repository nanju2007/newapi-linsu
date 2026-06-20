package common

import (
	"fmt"
	"strings"
	"sync"
	"time"
)

type StreamEndReason string

const (
	StreamEndReasonNone        StreamEndReason = ""
	StreamEndReasonDone        StreamEndReason = "done"
	StreamEndReasonTimeout     StreamEndReason = "timeout"
	StreamEndReasonClientGone  StreamEndReason = "client_gone"
	StreamEndReasonScannerErr  StreamEndReason = "scanner_error"
	StreamEndReasonHandlerStop StreamEndReason = "handler_stop"
	StreamEndReasonEOF         StreamEndReason = "eof"
	StreamEndReasonPanic       StreamEndReason = "panic"
	StreamEndReasonPingFail    StreamEndReason = "ping_fail"
)

// StreamEndSide 标识流式传输中断/结束发生在「哪一方」，便于排查是客户端主动中断还是上游连接异常。
type StreamEndSide string

const (
	StreamEndSideNone     StreamEndSide = ""
	StreamEndSideClient   StreamEndSide = "client"   // 客户端侧（下行连接）
	StreamEndSideUpstream StreamEndSide = "upstream" // 上游侧（上行连接）
	StreamEndSideServer   StreamEndSide = "server"   // 本服务内部
)

const maxStreamErrorEntries = 20

type StreamErrorEntry struct {
	Message   string
	Timestamp time.Time
}

type StreamStatus struct {
	EndReason StreamEndReason
	EndError  error
	endOnce   sync.Once

	mu         sync.Mutex
	Errors     []StreamErrorEntry
	ErrorCount int
}

func NewStreamStatus() *StreamStatus {
	return &StreamStatus{}
}

func (s *StreamStatus) SetEndReason(reason StreamEndReason, err error) {
	if s == nil {
		return
	}
	s.endOnce.Do(func() {
		s.EndReason = reason
		s.EndError = err
	})
}

func (s *StreamStatus) RecordError(msg string) {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ErrorCount++
	if len(s.Errors) < maxStreamErrorEntries {
		s.Errors = append(s.Errors, StreamErrorEntry{
			Message:   msg,
			Timestamp: time.Now(),
		})
	}
}

func (s *StreamStatus) HasErrors() bool {
	if s == nil {
		return false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.ErrorCount > 0
}

func (s *StreamStatus) TotalErrorCount() int {
	if s == nil {
		return 0
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.ErrorCount
}

func (s *StreamStatus) IsNormalEnd() bool {
	if s == nil {
		return true
	}
	return s.EndReason == StreamEndReasonDone ||
		s.EndReason == StreamEndReasonEOF ||
		s.EndReason == StreamEndReasonHandlerStop
}

// EndSide 返回中断/结束发生在哪一方，便于区分「客户端主动断开」与「上游连接异常」。
func (s *StreamStatus) EndSide() StreamEndSide {
	if s == nil {
		return StreamEndSideNone
	}
	switch s.EndReason {
	case StreamEndReasonClientGone, StreamEndReasonPingFail:
		return StreamEndSideClient
	case StreamEndReasonScannerErr, StreamEndReasonTimeout:
		return StreamEndSideUpstream
	case StreamEndReasonPanic:
		return StreamEndSideServer
	default:
		return StreamEndSideNone
	}
}

// Description 返回中断/结束原因的可读中文描述，明确指出是客户端还是上游导致。
func (s *StreamStatus) Description() string {
	if s == nil {
		return ""
	}
	switch s.EndReason {
	case StreamEndReasonClientGone:
		return "客户端主动中断（客户端取消请求或关闭了连接）"
	case StreamEndReasonPingFail:
		return "客户端连接异常（向客户端发送数据失败，客户端可能已断开）"
	case StreamEndReasonScannerErr:
		return "上游连接中断（读取上游响应数据时出错）"
	case StreamEndReasonTimeout:
		return "上游响应超时（在限定时间内未再收到上游数据）"
	case StreamEndReasonPanic:
		return "服务端内部异常"
	case StreamEndReasonDone:
		return "正常结束"
	case StreamEndReasonEOF:
		return "上游连接结束"
	case StreamEndReasonHandlerStop:
		return "处理完成"
	default:
		return string(s.EndReason)
	}
}

func (s *StreamStatus) Summary() string {
	if s == nil {
		return "StreamStatus<nil>"
	}
	b := &strings.Builder{}
	fmt.Fprintf(b, "reason=%s", s.EndReason)
	if side := s.EndSide(); side != StreamEndSideNone {
		fmt.Fprintf(b, " side=%s", side)
	}
	if desc := s.Description(); desc != "" {
		fmt.Fprintf(b, " desc=%q", desc)
	}
	if s.EndError != nil {
		fmt.Fprintf(b, " end_error=%q", s.EndError.Error())
	}
	s.mu.Lock()
	if s.ErrorCount > 0 {
		fmt.Fprintf(b, " soft_errors=%d", s.ErrorCount)
	}
	s.mu.Unlock()
	return b.String()
}
