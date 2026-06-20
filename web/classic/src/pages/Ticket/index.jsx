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
  Modal,
  Input,
  TextArea,
  Select,
  Typography,
  Empty,
} from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';
import {
  API,
  showError,
  showSuccess,
  timestamp2string,
  isAdmin,
} from '../../helpers';

const { Text, Title } = Typography;

const statusTagMap = {
  open: { color: 'orange', text: '待处理' },
  replied: { color: 'blue', text: '已回复' },
  closed: { color: 'grey', text: '已关闭' },
};

const Ticket = () => {
  const { t } = useTranslation();
  const admin = isAdmin();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');

  // 创建工单
  const [createVisible, setCreateVisible] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [newContent, setNewContent] = useState('');

  // 工单详情
  const [detailVisible, setDetailVisible] = useState(false);
  const [detail, setDetail] = useState(null);
  const [replyContent, setReplyContent] = useState('');

  const loadData = async (p = page) => {
    setLoading(true);
    try {
      const url = admin
        ? `/api/ticket_admin/all?p=${p}&page_size=${pageSize}&status=${statusFilter}`
        : `/api/ticket/self?p=${p}&page_size=${pageSize}`;
      const res = await API.get(url);
      if (res.data.success) {
        setData(res.data.data.items || []);
        setTotal(res.data.data.total || 0);
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(t('加载工单失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(1);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const submitCreate = async () => {
    if (!newTitle || !newContent) {
      showError(t('请填写工单标题和内容'));
      return;
    }
    try {
      const res = await API.post('/api/ticket/', {
        title: newTitle,
        category: newCategory,
        content: newContent,
      });
      if (res.data.success) {
        showSuccess(t('工单创建成功'));
        setCreateVisible(false);
        setNewTitle('');
        setNewContent('');
        loadData(1);
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(t('工单创建失败'));
    }
  };

  const openDetail = async (record) => {
    try {
      const url = admin
        ? `/api/ticket_admin/${record.id}`
        : `/api/ticket/${record.id}`;
      const res = await API.get(url);
      if (res.data.success) {
        setDetail(res.data.data);
        setReplyContent('');
        setDetailVisible(true);
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(t('加载工单详情失败'));
    }
  };

  const submitReply = async () => {
    if (!replyContent) {
      showError(t('回复内容不能为空'));
      return;
    }
    try {
      const url = admin
        ? `/api/ticket_admin/${detail.id}/reply`
        : `/api/ticket/${detail.id}/reply`;
      const res = await API.post(url, { content: replyContent });
      if (res.data.success) {
        showSuccess(t('回复成功'));
        openDetail({ id: detail.id });
        loadData();
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(t('回复失败'));
    }
  };

  const closeTicket = async () => {
    try {
      const url = admin
        ? `/api/ticket_admin/${detail.id}/close`
        : `/api/ticket/${detail.id}/close`;
      const res = await API.post(url, {});
      if (res.data.success) {
        showSuccess(t('工单已关闭'));
        setDetailVisible(false);
        loadData();
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(t('关闭失败'));
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    ...(admin ? [{ title: t('用户'), dataIndex: 'username' }] : []),
    { title: t('标题'), dataIndex: 'title' },
    { title: t('分类'), dataIndex: 'category' },
    {
      title: t('状态'),
      dataIndex: 'status',
      render: (v) => {
        const conf = statusTagMap[v] || { color: 'grey', text: v };
        return <Tag color={conf.color}>{t(conf.text)}</Tag>;
      },
    },
    {
      title: t('更新时间'),
      dataIndex: 'updated_time',
      render: (v) => (v ? timestamp2string(v) : '-'),
    },
    {
      title: t('操作'),
      render: (_, record) => (
        <Button size='small' theme='outline' onClick={() => openDetail(record)}>
          {t('查看')}
        </Button>
      ),
    },
  ];

  return (
    <div className='mt-[60px] px-2'>
      <div className='flex items-center justify-between mb-3'>
        <Space>
          {admin && (
            <Select
              value={statusFilter}
              onChange={(v) => setStatusFilter(v)}
              style={{ width: 160 }}
            >
              <Select.Option value=''>{t('全部')}</Select.Option>
              <Select.Option value='open'>{t('待处理')}</Select.Option>
              <Select.Option value='replied'>{t('已回复')}</Select.Option>
              <Select.Option value='closed'>{t('已关闭')}</Select.Option>
            </Select>
          )}
        </Space>
        {!admin && (
          <Button
            theme='solid'
            type='primary'
            onClick={() => setCreateVisible(true)}
          >
            {t('创建工单')}
          </Button>
        )}
      </div>

      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey='id'
        pagination={{
          currentPage: page,
          pageSize,
          total,
          onPageChange: (p) => {
            setPage(p);
            loadData(p);
          },
        }}
        empty={<Empty description={t('暂无工单')} />}
      />

      {/* 创建工单 */}
      <Modal
        title={t('创建工单')}
        visible={createVisible}
        onOk={submitCreate}
        onCancel={() => setCreateVisible(false)}
        centered
      >
        <div className='space-y-3'>
          <div>
            <Text strong className='block mb-1'>
              {t('标题')}
            </Text>
            <Input
              value={newTitle}
              onChange={(v) => setNewTitle(v)}
              placeholder={t('请输入工单标题')}
            />
          </div>
          <div>
            <Text strong className='block mb-1'>
              {t('分类')}
            </Text>
            <Select
              value={newCategory}
              onChange={(v) => setNewCategory(v)}
              className='w-full'
            >
              <Select.Option value='general'>{t('一般问题')}</Select.Option>
              <Select.Option value='billing'>{t('计费问题')}</Select.Option>
              <Select.Option value='technical'>{t('技术问题')}</Select.Option>
            </Select>
          </div>
          <div>
            <Text strong className='block mb-1'>
              {t('内容')}
            </Text>
            <TextArea
              value={newContent}
              onChange={(v) => setNewContent(v)}
              rows={5}
              placeholder={t('请详细描述您的问题')}
            />
          </div>
        </div>
      </Modal>

      {/* 工单详情 */}
      <Modal
        title={detail ? `${t('工单')} #${detail.id} · ${detail.title}` : t('工单详情')}
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        size='large'
        centered
      >
        {detail && (
          <div>
            <div className='mb-3'>
              <Tag color={(statusTagMap[detail.status] || {}).color}>
                {t((statusTagMap[detail.status] || {}).text || detail.status)}
              </Tag>
            </div>
            <div
              className='space-y-3 mb-4'
              style={{ maxHeight: 360, overflowY: 'auto' }}
            >
              {(detail.messages || []).map((m) => {
                // 气泡方向以当前查看者为基准：自己发的靠右，对方靠左
                const isMine = admin ? m.is_admin : !m.is_admin;
                const senderLabel = m.is_admin
                  ? admin
                    ? t('我（客服）')
                    : t('客服')
                  : admin
                    ? detail.username || t('用户')
                    : t('我');
                return (
                  <div
                    key={m.id}
                    className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className='rounded-lg px-3 py-2 max-w-[75%]'
                      style={{
                        background: isMine
                          ? 'var(--semi-color-primary-light-default)'
                          : 'var(--semi-color-fill-0)',
                      }}
                    >
                      <div className='text-xs mb-1'>
                        <Text type='tertiary'>
                          {senderLabel} ·{' '}
                          {timestamp2string(m.created_time)}
                        </Text>
                      </div>
                      <Text>{m.content}</Text>
                    </div>
                  </div>
                );
              })}
            </div>

            {detail.status !== 'closed' ? (
              <div className='space-y-2'>
                <TextArea
                  value={replyContent}
                  onChange={(v) => setReplyContent(v)}
                  rows={3}
                  placeholder={t('输入回复内容')}
                />
                <div className='flex justify-end gap-2'>
                  <Button type='danger' onClick={closeTicket}>
                    {t('关闭工单')}
                  </Button>
                  <Button theme='solid' type='primary' onClick={submitReply}>
                    {t('回复')}
                  </Button>
                </div>
              </div>
            ) : (
              <Text type='tertiary'>{t('该工单已关闭')}</Text>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Ticket;
