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

import React, { useEffect, useRef, useState } from 'react';
import {
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Select,
  SideSheet,
  Space,
  Spin,
  Switch,
  Tag,
  TextArea,
  Typography,
  Tabs,
  TabPane,
  Upload,
} from '@douyinfe/semi-ui';
import {
  IconSearch,
  IconPlus,
  IconEdit,
  IconDelete,
  IconSave,
  IconClose,
  IconEyeOpened,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import {
  API,
  showError,
  showSuccess,
  isAdmin,
  timestamp2string,
} from '../../helpers';
import MarkdownRenderer from '../../components/common/markdown/MarkdownRenderer';
import { useIsMobile } from '../../hooks/common/useIsMobile';

const { Text, Title, Paragraph } = Typography;

const PAGE_SIZE = 12;

const HelpCenter = () => {
  const { t } = useTranslation();
  const admin = isAdmin();
  const isMobile = useIsMobile();

  // 列表/搜索
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // 详情
  const [detailVisible, setDetailVisible] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 管理：编辑抽屉
  const [editVisible, setEditVisible] = useState(false);
  const [editing, setEditing] = useState(null); // null=新建
  const [form, setForm] = useState({
    title: '',
    category: '',
    summary: '',
    content: '',
    sort_order: 0,
    published: true,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const contentRef = useRef(null);

  const loadCategories = async () => {
    try {
      const res = await API.get('/api/help/categories');
      if (res.data?.success) {
        setCategories(res.data.data || []);
      }
    } catch (e) {
      // ignore
    }
  };

  const loadDocs = async (p = page) => {
    setLoading(true);
    try {
      const base = admin ? '/api/help_admin/all' : '/api/help/';
      const url = `${base}?p=${p}&page_size=${PAGE_SIZE}&keyword=${encodeURIComponent(
        keyword,
      )}&category=${encodeURIComponent(category)}`;
      const res = await API.get(url);
      if (res.data?.success) {
        setDocs(res.data.data.items || []);
        setTotal(res.data.data.total || 0);
        setPage(res.data.data.page || p);
      } else {
        showError(res.data?.message);
      }
    } catch (e) {
      showError(t('加载帮助文档失败'));
    }
    setLoading(false);
  };

  useEffect(() => {
    loadCategories();
    loadDocs(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => {
    setPage(1);
    loadDocs(1);
  };

  const openDetail = async (doc) => {
    setDetailVisible(true);
    setDetailLoading(true);
    setDetail(null);
    try {
      const url = admin ? `/api/help_admin/${doc.id}` : `/api/help/${doc.id}`;
      const res = await API.get(url);
      if (res.data?.success) {
        setDetail(res.data.data);
      } else {
        showError(res.data?.message);
      }
    } catch (e) {
      showError(t('加载帮助文档失败'));
    }
    setDetailLoading(false);
  };

  // ---- 管理：增删改 ----
  const openCreate = () => {
    setEditing(null);
    setForm({
      title: '',
      category: '',
      summary: '',
      content: '',
      sort_order: 0,
      published: true,
    });
    setEditVisible(true);
  };

  const openEdit = async (doc) => {
    try {
      const res = await API.get(`/api/help_admin/${doc.id}`);
      if (res.data?.success) {
        const d = res.data.data;
        setEditing(d);
        setForm({
          title: d.title || '',
          category: d.category || '',
          summary: d.summary || '',
          content: d.content || '',
          sort_order: d.sort_order || 0,
          published: d.published !== false,
        });
        setEditVisible(true);
      } else {
        showError(res.data?.message);
      }
    } catch (e) {
      showError(t('加载帮助文档失败'));
    }
  };

  const saveDoc = async () => {
    if (!form.title.trim()) {
      showError(t('标题不能为空'));
      return;
    }
    setSaving(true);
    try {
      let res;
      if (editing) {
        res = await API.put(`/api/help_admin/${editing.id}`, form);
      } else {
        res = await API.post('/api/help_admin/', form);
      }
      if (res.data?.success) {
        showSuccess(editing ? t('更新成功') : t('创建成功'));
        setEditVisible(false);
        loadCategories();
        loadDocs(editing ? page : 1);
      } else {
        showError(res.data?.message);
      }
    } catch (e) {
      showError(t('保存失败，请重试'));
    }
    setSaving(false);
  };

  const deleteDoc = (doc) => {
    Modal.confirm({
      title: t('确认删除'),
      content: `${t('确定删除帮助文档')}「${doc.title}」?`,
      onOk: async () => {
        try {
          const res = await API.delete(`/api/help_admin/${doc.id}`);
          if (res.data?.success) {
            showSuccess(t('删除成功'));
            loadDocs(page);
          } else {
            showError(res.data?.message);
          }
        } catch (e) {
          showError(t('删除失败'));
        }
      },
    });
  };

  // 在光标处插入文本（用于图片上传后插入 Markdown 链接）
  const insertAtCursor = (text) => {
    setForm((prev) => ({ ...prev, content: `${prev.content}\n${text}\n` }));
  };

  const customUpload = async ({ file, onSuccess, onError }) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file.fileInstance || file);
      const res = await API.post('/api/help_admin/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.success) {
        const url = res.data.data.url;
        insertAtCursor(`![${file.name || 'image'}](${url})`);
        showSuccess(t('图片上传成功'));
        onSuccess && onSuccess(res.data);
      } else {
        showError(res.data?.message || t('图片上传失败'));
        onError && onError(new Error('upload failed'));
      }
    } catch (e) {
      showError(t('图片上传失败'));
      onError && onError(e);
    }
    setUploading(false);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className='mt-[60px] px-2 pb-6'>
      {/* 顶部：标题 + 搜索 + 管理操作 */}
      <Card className='!rounded-2xl shadow-sm border-0 mb-3'>
        <div className='flex flex-col md:flex-row md:items-center justify-between gap-3'>
          <div>
            <Title heading={4} className='m-0'>
              {t('帮助中心')}
            </Title>
            <Text type='tertiary' size='small'>
              {t('搜索并浏览帮助文档，快速找到你需要的答案')}
            </Text>
          </div>
          <Space wrap>
            <Select
              placeholder={t('全部分类')}
              value={category || ''}
              onChange={(v) => {
                setCategory(v);
                setPage(1);
                setTimeout(() => loadDocs(1), 0);
              }}
              style={{ width: 160 }}
              showClear
            >
              <Select.Option value=''>{t('全部分类')}</Select.Option>
              {categories.map((c) => (
                <Select.Option key={c} value={c}>
                  {c}
                </Select.Option>
              ))}
            </Select>
            <Input
              prefix={<IconSearch />}
              placeholder={t('搜索帮助文档')}
              value={keyword}
              onChange={(v) => setKeyword(v)}
              onEnterPress={handleSearch}
              showClear
              style={{ width: isMobile ? '100%' : 240 }}
            />
            <Button theme='solid' type='primary' onClick={handleSearch}>
              {t('搜索')}
            </Button>
            {admin && (
              <Button icon={<IconPlus />} onClick={openCreate}>
                {t('新建文档')}
              </Button>
            )}
          </Space>
        </div>
      </Card>

      {/* 文档列表 */}
      <Spin spinning={loading}>
        {docs.length === 0 ? (
          <Card className='!rounded-2xl shadow-sm border-0'>
            <Empty description={t('暂无帮助文档')} style={{ padding: 40 }} />
          </Card>
        ) : (
          <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3'>
            {docs.map((doc) => (
              <Card
                key={doc.id}
                className='!rounded-2xl shadow-sm border-0 cursor-pointer hover:shadow-md transition-shadow'
                onClick={() => openDetail(doc)}
              >
                <div className='flex items-start justify-between gap-2'>
                  <div className='min-w-0 flex-1'>
                    <div className='flex items-center gap-2 mb-1'>
                      {doc.category ? (
                        <Tag color='blue' shape='circle' size='small'>
                          {doc.category}
                        </Tag>
                      ) : null}
                      {admin && doc.published === false && (
                        <Tag color='grey' shape='circle' size='small'>
                          {t('未发布')}
                        </Tag>
                      )}
                    </div>
                    <Text
                      strong
                      ellipsis={{ showTooltip: true }}
                      style={{ display: 'block', fontSize: 15 }}
                    >
                      {doc.title}
                    </Text>
                    {doc.summary ? (
                      <Paragraph
                        type='tertiary'
                        size='small'
                        ellipsis={{ rows: 2 }}
                        style={{ marginTop: 4 }}
                      >
                        {doc.summary}
                      </Paragraph>
                    ) : null}
                  </div>
                </div>
                <div className='flex items-center justify-between mt-3'>
                  <Text type='tertiary' size='small'>
                    <IconEyeOpened size='small' /> {doc.views || 0} ·{' '}
                    {doc.updated_time ? timestamp2string(doc.updated_time) : ''}
                  </Text>
                  {admin && (
                    <Space>
                      <Button
                        size='small'
                        theme='borderless'
                        icon={<IconEdit />}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(doc);
                        }}
                      />
                      <Button
                        size='small'
                        theme='borderless'
                        type='danger'
                        icon={<IconDelete />}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteDoc(doc);
                        }}
                      />
                    </Space>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* 简单分页 */}
        {total > PAGE_SIZE && (
          <div className='flex justify-center items-center gap-3 mt-4'>
            <Button
              disabled={page <= 1}
              onClick={() => {
                const p = page - 1;
                setPage(p);
                loadDocs(p);
              }}
            >
              {t('上一页')}
            </Button>
            <Text type='tertiary'>
              {page} / {totalPages}
            </Text>
            <Button
              disabled={page >= totalPages}
              onClick={() => {
                const p = page + 1;
                setPage(p);
                loadDocs(p);
              }}
            >
              {t('下一页')}
            </Button>
          </div>
        )}
      </Spin>

      {/* 详情抽屉 */}
      <SideSheet
        placement='right'
        title={detail ? detail.title : t('帮助文档')}
        visible={detailVisible}
        width={isMobile ? '100%' : 720}
        onCancel={() => setDetailVisible(false)}
      >
        <Spin spinning={detailLoading}>
          {detail && (
            <div>
              <div className='mb-3'>
                <Space wrap>
                  {detail.category ? (
                    <Tag color='blue' shape='circle'>
                      {detail.category}
                    </Tag>
                  ) : null}
                  <Text type='tertiary' size='small'>
                    {detail.updated_time
                      ? timestamp2string(detail.updated_time)
                      : ''}
                  </Text>
                </Space>
              </div>
              <div className='prose max-w-none'>
                <MarkdownRenderer content={detail.content || ''} />
              </div>
            </div>
          )}
        </Spin>
      </SideSheet>

      {/* 管理：新建/编辑抽屉（带 MD 编辑器 + 预览 + 图片上传） */}
      {admin && (
        <SideSheet
          placement='right'
          title={
            <Space>
              <Tag color={editing ? 'blue' : 'green'} shape='circle'>
                {editing ? t('编辑') : t('新建')}
              </Tag>
              <Title heading={5} className='m-0'>
                {editing ? t('编辑帮助文档') : t('新建帮助文档')}
              </Title>
            </Space>
          }
          visible={editVisible}
          width={isMobile ? '100%' : 820}
          onCancel={() => setEditVisible(false)}
          footer={
            <div className='flex justify-end'>
              <Space>
                <Button
                  theme='solid'
                  icon={<IconSave />}
                  loading={saving}
                  onClick={saveDoc}
                >
                  {t('保存')}
                </Button>
                <Button
                  theme='light'
                  type='primary'
                  icon={<IconClose />}
                  onClick={() => setEditVisible(false)}
                >
                  {t('取消')}
                </Button>
              </Space>
            </div>
          }
        >
          <div className='space-y-3'>
            <div>
              <Text strong className='block mb-1'>
                {t('标题')}
              </Text>
              <Input
                value={form.title}
                onChange={(v) => setForm((p) => ({ ...p, title: v }))}
                placeholder={t('请输入文档标题')}
                showClear
              />
            </div>
            <div className='flex gap-3 flex-col md:flex-row'>
              <div className='flex-1'>
                <Text strong className='block mb-1'>
                  {t('分类')}
                </Text>
                <Input
                  value={form.category}
                  onChange={(v) => setForm((p) => ({ ...p, category: v }))}
                  placeholder={t('例如：快速开始 / 计费说明')}
                  showClear
                />
              </div>
              <div style={{ width: isMobile ? '100%' : 140 }}>
                <Text strong className='block mb-1'>
                  {t('排序')}
                </Text>
                <Input
                  type='number'
                  value={String(form.sort_order)}
                  onChange={(v) =>
                    setForm((p) => ({ ...p, sort_order: parseInt(v) || 0 }))
                  }
                />
              </div>
              <div className='flex flex-col'>
                <Text strong className='block mb-1'>
                  {t('发布')}
                </Text>
                <Switch
                  checked={form.published}
                  onChange={(v) => setForm((p) => ({ ...p, published: v }))}
                />
              </div>
            </div>
            <div>
              <Text strong className='block mb-1'>
                {t('摘要')}
              </Text>
              <Input
                value={form.summary}
                onChange={(v) => setForm((p) => ({ ...p, summary: v }))}
                placeholder={t('一句话描述，展示在列表卡片上')}
                showClear
              />
            </div>

            <div>
              <div className='flex items-center justify-between mb-1'>
                <Text strong>{t('正文（Markdown）')}</Text>
                <Upload
                  accept='image/*'
                  showUploadList={false}
                  customRequest={customUpload}
                >
                  <Button size='small' loading={uploading} icon={<IconPlus />}>
                    {t('上传图片')}
                  </Button>
                </Upload>
              </div>
              <Tabs type='line' defaultActiveKey='edit'>
                <TabPane tab={t('编辑')} itemKey='edit'>
                  <TextArea
                    ref={contentRef}
                    value={form.content}
                    onChange={(v) => setForm((p) => ({ ...p, content: v }))}
                    autosize={{ minRows: 14, maxRows: 30 }}
                    placeholder={t('支持 Markdown 语法，可插入图片、代码块、表格等')}
                  />
                </TabPane>
                <TabPane tab={t('预览')} itemKey='preview'>
                  <div
                    className='prose max-w-none'
                    style={{
                      minHeight: 200,
                      padding: 12,
                      border: '1px solid var(--semi-color-border)',
                      borderRadius: 8,
                    }}
                  >
                    <MarkdownRenderer content={form.content || ''} />
                  </div>
                </TabPane>
              </Tabs>
            </div>
          </div>
        </SideSheet>
      )}
    </div>
  );
};

export default HelpCenter;
