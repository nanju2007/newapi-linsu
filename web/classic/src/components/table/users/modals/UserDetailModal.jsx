/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  API,
  showError,
  renderQuota,
  renderNumber,
  timestamp2string,
} from '../../../../helpers';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';
import {
  SideSheet,
  Space,
  Spin,
  Typography,
  Card,
  Tag,
  Avatar,
  Table,
  Select,
  Empty,
} from '@douyinfe/semi-ui';
import { IconUser, IconHistogram } from '@douyinfe/semi-icons';

const { Text, Title } = Typography;

const PAGE_SIZE = 10;

// 日志类型，与后端 model.LogType* 常量保持一致
const LOG_TYPE_OPTIONS = (t) => [
  { label: t('全部'), value: 0 },
  { label: t('充值'), value: 1 },
  { label: t('消费'), value: 2 },
  { label: t('管理'), value: 3 },
  { label: t('系统'), value: 4 },
  { label: t('错误'), value: 5 },
  { label: t('退款'), value: 6 },
  { label: t('登录'), value: 7 },
];

const logTypeTag = (type, t) => {
  const map = {
    1: { color: 'green', text: t('充值') },
    2: { color: 'blue', text: t('消费') },
    3: { color: 'yellow', text: t('管理') },
    4: { color: 'grey', text: t('系统') },
    5: { color: 'red', text: t('错误') },
    6: { color: 'purple', text: t('退款') },
    7: { color: 'cyan', text: t('登录') },
  };
  const conf = map[type] || { color: 'grey', text: t('未知') };
  return (
    <Tag color={conf.color} shape='circle' size='small'>
      {conf.text}
    </Tag>
  );
};

const renderRole = (role, t) => {
  switch (role) {
    case 1:
      return <Tag color='blue' shape='circle'>{t('普通用户')}</Tag>;
    case 10:
      return <Tag color='yellow' shape='circle'>{t('管理员')}</Tag>;
    case 100:
      return <Tag color='orange' shape='circle'>{t('超级管理员')}</Tag>;
    default:
      return <Tag color='red' shape='circle'>{t('未知身份')}</Tag>;
  }
};

const renderStatus = (status, deletedAt, t) => {
  if (deletedAt) {
    return <Tag color='red' shape='circle'>{t('已注销')}</Tag>;
  }
  if (status === 1) {
    return <Tag color='green' shape='circle'>{t('已启用')}</Tag>;
  }
  if (status === 2) {
    return <Tag color='red' shape='circle'>{t('已禁用')}</Tag>;
  }
  return <Tag color='grey' shape='circle'>{t('未知状态')}</Tag>;
};

const UserDetailModal = (props) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { visible, handleClose, user } = props;
  const userId = user?.id;

  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);

  const [logs, setLogs] = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logType, setLogType] = useState(0);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const loadDetail = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await API.get(`/api/user/${userId}`);
      const { success, message, data } = res.data;
      if (success) {
        setDetail(data);
      } else {
        showError(message);
      }
    } catch (e) {
      showError(e.message);
    }
    setLoading(false);
  };

  const loadLogs = async (p = page, type = logType) => {
    const username = detail?.username || user?.username;
    if (!username) return;
    setLogLoading(true);
    try {
      const res = await API.get(
        `/api/log/?username=${encodeURIComponent(username)}&type=${type}&p=${p}&page_size=${PAGE_SIZE}`,
      );
      const { success, message, data } = res.data;
      if (success) {
        setLogs(data.items || []);
        setTotal(data.total || 0);
        setPage(data.page || p);
      } else {
        showError(message);
      }
    } catch (e) {
      showError(e.message);
    }
    setLogLoading(false);
  };

  useEffect(() => {
    if (visible && userId) {
      setLogType(0);
      setPage(1);
      setLogs([]);
      setTotal(0);
      loadDetail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, userId]);

  // 详情加载完成后再拉取账单（依赖 username）
  useEffect(() => {
    if (visible && (detail?.username || user?.username)) {
      loadLogs(1, logType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail]);

  const onTypeChange = (val) => {
    setLogType(val);
    setPage(1);
    loadLogs(1, val);
  };

  const used = parseInt(detail?.used_quota) || 0;
  const remain = parseInt(detail?.quota) || 0;

  const infoItem = (label, value) => (
    <div className='flex flex-col gap-1'>
      <Text type='tertiary' size='small'>
        {label}
      </Text>
      <div className='text-sm'>{value}</div>
    </div>
  );

  const columns = [
    {
      title: t('时间'),
      dataIndex: 'created_at',
      render: (v) => (v ? timestamp2string(v) : '-'),
      width: 160,
    },
    {
      title: t('类型'),
      dataIndex: 'type',
      render: (v) => logTypeTag(v, t),
      width: 90,
    },
    {
      title: t('模型'),
      dataIndex: 'model_name',
      render: (v) => (v ? <Tag color='white' shape='circle'>{v}</Tag> : '-'),
    },
    {
      title: t('令牌'),
      dataIndex: 'token_name',
      render: (v) => v || '-',
    },
    {
      title: t('提示'),
      dataIndex: 'prompt_tokens',
      render: (v) => renderNumber(v || 0),
      width: 80,
    },
    {
      title: t('补全'),
      dataIndex: 'completion_tokens',
      render: (v) => renderNumber(v || 0),
      width: 80,
    },
    {
      title: t('额度'),
      dataIndex: 'quota',
      render: (v, record) =>
        record.type === 2 || record.type === 1 || record.type === 6
          ? renderQuota(v || 0)
          : '-',
      width: 100,
    },
    {
      title: t('详情'),
      dataIndex: 'content',
      render: (v) => (
        <Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 240 }}>
          {v || '-'}
        </Text>
      ),
    },
  ];

  return (
    <SideSheet
      placement='right'
      title={
        <Space>
          <Tag color='blue' shape='circle'>
            {t('查看')}
          </Tag>
          <Title heading={4} className='m-0'>
            {t('用户详情')}
          </Title>
        </Space>
      }
      bodyStyle={{ padding: 0 }}
      visible={visible}
      width={isMobile ? '100%' : 760}
      closeIcon={null}
      onCancel={handleClose}
    >
      <Spin spinning={loading}>
        <div className='p-2 space-y-3'>
          {/* 用户基本信息 */}
          <Card className='!rounded-2xl shadow-sm border-0'>
            <div className='flex items-center mb-3'>
              <Avatar size='small' color='blue' className='mr-2 shadow-md'>
                <IconUser size={16} />
              </Avatar>
              <div>
                <Text className='text-lg font-medium'>{t('基本信息')}</Text>
                <div className='text-xs text-gray-600'>
                  {t('用户的账户与额度概览')}
                </div>
              </div>
            </div>

            <div className='grid grid-cols-2 md:grid-cols-3 gap-4'>
              {infoItem('ID', detail?.id ?? user?.id ?? '-')}
              {infoItem(t('用户名'), detail?.username || '-')}
              {infoItem(t('显示名称'), detail?.display_name || '-')}
              {infoItem(t('邮箱'), detail?.email || '-')}
              {infoItem(t('分组'), detail?.group ? (
                <Tag color='blue' shape='circle'>{detail.group}</Tag>
              ) : '-')}
              {infoItem(t('角色'), renderRole(detail?.role, t))}
              {infoItem(
                t('状态'),
                renderStatus(detail?.status, detail?.DeletedAt, t),
              )}
              {infoItem(t('剩余额度'), renderQuota(remain))}
              {infoItem(t('已用额度'), renderQuota(used))}
              {infoItem(t('调用次数'), renderNumber(detail?.request_count || 0))}
              {infoItem(t('邀请人数'), renderNumber(detail?.aff_count || 0))}
              {infoItem(t('邀请收益'), renderQuota(detail?.aff_history_quota || 0))}
              {infoItem(
                t('注册时间'),
                detail?.created_at ? timestamp2string(detail.created_at) : '-',
              )}
              {infoItem(
                t('备注'),
                detail?.remark ? (
                  <Text ellipsis={{ showTooltip: true }} style={{ maxWidth: 180 }}>
                    {detail.remark}
                  </Text>
                ) : '-',
              )}
            </div>
          </Card>

          {/* 完整账单/明细 */}
          <Card className='!rounded-2xl shadow-sm border-0'>
            <div className='flex items-center justify-between mb-3 flex-wrap gap-2'>
              <div className='flex items-center'>
                <Avatar size='small' color='green' className='mr-2 shadow-md'>
                  <IconHistogram size={16} />
                </Avatar>
                <div>
                  <Text className='text-lg font-medium'>{t('完整账单')}</Text>
                  <div className='text-xs text-gray-600'>
                    {t('该用户的全部消费、充值与操作明细')}
                  </div>
                </div>
              </div>
              <Select
                value={logType}
                onChange={onTypeChange}
                optionList={LOG_TYPE_OPTIONS(t)}
                style={{ width: 140 }}
              />
            </div>

            <Table
              columns={columns}
              dataSource={logs}
              loading={logLoading}
              rowKey='id'
              size='small'
              scroll={{ x: 'max-content' }}
              pagination={{
                currentPage: page,
                pageSize: PAGE_SIZE,
                total,
                onPageChange: (p) => {
                  setPage(p);
                  loadLogs(p, logType);
                },
              }}
              empty={<Empty description={t('暂无数据')} />}
            />
          </Card>
        </div>
      </Spin>
    </SideSheet>
  );
};

export default UserDetailModal;
