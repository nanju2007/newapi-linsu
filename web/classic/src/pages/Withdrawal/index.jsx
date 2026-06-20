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
import {
  Table,
  Tag,
  Button,
  Space,
  Select,
  Modal,
  Input,
  Typography,
} from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import {
  API,
  showError,
  showSuccess,
  timestamp2string,
  renderQuota,
} from '../../helpers';

const { Text } = Typography;

const statusTagMap = {
  pending: { color: 'orange', text: '待审核' },
  approved: { color: 'green', text: '已通过' },
  rejected: { color: 'red', text: '已拒绝' },
};

const WithdrawalManagement = () => {
  const { t } = useTranslation();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  // 处理弹窗
  const [processVisible, setProcessVisible] = useState(false);
  const [processTarget, setProcessTarget] = useState(null);
  const [processAction, setProcessAction] = useState('approve');
  const [adminComment, setAdminComment] = useState('');

  const loadData = async (p = page, ps = pageSize, status = statusFilter) => {
    setLoading(true);
    try {
      const res = await API.get(
        `/api/user/withdrawal?p=${p}&page_size=${ps}&status=${status}`,
      );
      if (res.data.success) {
        const payload = res.data.data;
        setData(payload.items || []);
        setTotal(payload.total || 0);
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(t('加载提现记录失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(1, pageSize, statusFilter);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const openProcess = (record, action) => {
    setProcessTarget(record);
    setProcessAction(action);
    setAdminComment('');
    setProcessVisible(true);
  };

  const submitProcess = async () => {
    if (!processTarget) return;
    const url =
      processAction === 'approve'
        ? '/api/user/withdrawal/approve'
        : '/api/user/withdrawal/reject';
    try {
      const res = await API.post(url, {
        id: processTarget.id,
        admin_comment: adminComment,
      });
      if (res.data.success) {
        showSuccess(t('处理成功'));
        setProcessVisible(false);
        loadData();
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(t('处理失败'));
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: t('用户'), dataIndex: 'username' },
    {
      title: t('提现额度'),
      dataIndex: 'quota',
      render: (v) => renderQuota(v),
    },
    {
      title: t('收款方式'),
      dataIndex: 'account_type',
    },
    {
      title: t('收款账号'),
      dataIndex: 'account_info',
    },
    {
      title: t('收款人'),
      dataIndex: 'real_name',
    },
    {
      title: t('用户备注'),
      dataIndex: 'comment',
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      render: (v) => {
        const conf = statusTagMap[v] || { color: 'grey', text: v };
        return <Tag color={conf.color}>{t(conf.text)}</Tag>;
      },
    },
    {
      title: t('管理员备注'),
      dataIndex: 'admin_comment',
    },
    {
      title: t('申请时间'),
      dataIndex: 'created_time',
      render: (v) => (v ? timestamp2string(v) : '-'),
    },
    {
      title: t('操作'),
      dataIndex: 'op',
      render: (_, record) =>
        record.status === 'pending' ? (
          <Space>
            <Button
              theme='solid'
              type='primary'
              size='small'
              onClick={() => openProcess(record, 'approve')}
            >
              {t('通过')}
            </Button>
            <Button
              type='danger'
              size='small'
              onClick={() => openProcess(record, 'reject')}
            >
              {t('拒绝')}
            </Button>
          </Space>
        ) : (
          <Text type='tertiary'>{t('已处理')}</Text>
        ),
    },
  ];

  return (
    <div className='mt-[60px] px-2'>
      <div className='flex items-center gap-2 mb-3'>
        <Text strong>{t('提现状态筛选')}：</Text>
        <Select
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          style={{ width: 160 }}
        >
          <Select.Option value=''>{t('全部')}</Select.Option>
          <Select.Option value='pending'>{t('待审核')}</Select.Option>
          <Select.Option value='approved'>{t('已通过')}</Select.Option>
          <Select.Option value='rejected'>{t('已拒绝')}</Select.Option>
        </Select>
      </div>
      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={{
          currentPage: page,
          pageSize,
          total,
          onPageChange: (p) => {
            setPage(p);
            loadData(p, pageSize, statusFilter);
          },
        }}
        rowKey='id'
      />

      <Modal
        title={
          processAction === 'approve'
            ? t('通过提现申请')
            : t('拒绝提现申请')
        }
        visible={processVisible}
        onOk={submitProcess}
        onCancel={() => setProcessVisible(false)}
        centered
      >
        <div className='space-y-3'>
          {processTarget && (
            <Text>
              {t('用户')}: {processTarget.username} ·{' '}
              {t('提现额度')}: {renderQuota(processTarget.quota)}
            </Text>
          )}
          {processAction === 'reject' && (
            <Text type='warning' className='block'>
              {t('拒绝后将把冻结的邀请额度退回用户')}
            </Text>
          )}
          <Input
            value={adminComment}
            onChange={(v) => setAdminComment(v)}
            placeholder={t('管理员备注（选填）')}
          />
        </div>
      </Modal>
    </div>
  );
};

export default WithdrawalManagement;
