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

import React, { useEffect, useState, useRef } from 'react';
import {
  Avatar,
  Button,
  Card,
  Col,
  Form,
  Row,
  Select,
  SideSheet,
  Space,
  Spin,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconCalendarClock,
  IconClose,
  IconCreditCard,
  IconSave,
} from '@douyinfe/semi-icons';
import { Clock, RefreshCw } from 'lucide-react';
import { API, showError, showSuccess } from '../../../../helpers';
import {
  quotaToDisplayAmount,
  displayAmountToQuota,
} from '../../../../helpers/quota';
import { useIsMobile } from '../../../../hooks/common/useIsMobile';

const { Text, Title } = Typography;

const durationUnitOptions = [
  { value: 'year', label: '年' },
  { value: 'month', label: '月' },
  { value: 'day', label: '日' },
  { value: 'hour', label: '小时' },
  { value: 'custom', label: '自定义(秒)' },
];

const resetPeriodOptions = [
  { value: 'never', label: '不重置' },
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
  { value: 'custom', label: '自定义(秒)' },
];

const AddEditSubscriptionModal = ({
  visible,
  handleClose,
  editingPlan,
  placement = 'left',
  refresh,
  t,
}) => {
  const [loading, setLoading] = useState(false);
  const [groupOptions, setGroupOptions] = useState([]);
  const [groupLoading, setGroupLoading] = useState(false);
  const [modelOptions, setModelOptions] = useState([]);
  const isMobile = useIsMobile();
  const formApiRef = useRef(null);
  const isEdit = editingPlan?.plan?.id !== undefined;
  const formKey = isEdit ? `edit-${editingPlan?.plan?.id}` : 'create';

  const getInitValues = () => ({
    title: '',
    subtitle: '',
    price_amount: 0,
    currency: 'USD',
    duration_unit: 'month',
    duration_value: 1,
    custom_seconds: 0,
    quota_reset_period: 'never',
    quota_reset_custom_seconds: 0,
    enabled: true,
    sort_order: 0,
    max_purchase_per_user: 0,
    total_amount: 0,
    daily_enabled: false,
    weekly_enabled: false,
    monthly_enabled: false,
    daily_limit: 0,
    weekly_limit: 0,
    monthly_limit: 0,
    validity_months: 1,
    upgrade_group: '',
    stripe_price_id: '',
    creem_product_id: '',
    rpm_enabled: false,
    rpm_limit: 0,
    model_limits_enabled: false,
    model_limits: [],
    description: '',
    price_ratio: 1,
  });

  const buildFormValues = () => {
    const base = getInitValues();
    if (editingPlan?.plan?.id === undefined) return base;
    const p = editingPlan.plan || {};
    return {
      ...base,
      title: p.title || '',
      subtitle: p.subtitle || '',
      price_amount: Number(p.price_amount || 0),
      currency: 'USD',
      duration_unit: p.duration_unit || 'month',
      duration_value: Number(p.duration_value || 1),
      custom_seconds: Number(p.custom_seconds || 0),
      quota_reset_period: p.quota_reset_period || 'never',
      quota_reset_custom_seconds: Number(p.quota_reset_custom_seconds || 0),
      enabled: p.enabled !== false,
      sort_order: Number(p.sort_order || 0),
      max_purchase_per_user: Number(p.max_purchase_per_user || 0),
      total_amount: Number(
        quotaToDisplayAmount(p.total_amount || 0).toFixed(2),
      ),
      daily_enabled: !!p.daily_enabled,
      weekly_enabled: !!p.weekly_enabled,
      monthly_enabled: !!p.monthly_enabled,
      daily_limit: Number(quotaToDisplayAmount(p.daily_limit || 0).toFixed(2)),
      weekly_limit: Number(quotaToDisplayAmount(p.weekly_limit || 0).toFixed(2)),
      monthly_limit: Number(
        quotaToDisplayAmount(p.monthly_limit || 0).toFixed(2),
      ),
      validity_months: Number(p.validity_months || 1),
      upgrade_group: p.upgrade_group || '',
      stripe_price_id: p.stripe_price_id || '',
      creem_product_id: p.creem_product_id || '',
      rpm_enabled: !!p.rpm_enabled,
      rpm_limit: Number(p.rpm_limit || 0),
      model_limits_enabled: !!p.model_limits_enabled,
      model_limits:
        typeof p.model_limits === 'string' && p.model_limits !== ''
          ? p.model_limits.split(',').map((s) => s.trim()).filter(Boolean)
          : Array.isArray(p.model_limits)
            ? p.model_limits
            : [],
      description: p.description || '',
      price_ratio: Number(p.price_ratio) > 0 ? Number(p.price_ratio) : 1,
    };
  };

  useEffect(() => {
    if (!visible) return;
    setGroupLoading(true);
    API.get('/api/group')
      .then((res) => {
        if (res.data?.success) {
          setGroupOptions(res.data?.data || []);
        } else {
          setGroupOptions([]);
        }
      })
      .catch(() => setGroupOptions([]))
      .finally(() => setGroupLoading(false));
    // 加载可用模型供「模型限制列表」选择
    API.get('/api/user/models')
      .then((res) => {
        if (res.data?.success && Array.isArray(res.data.data)) {
          setModelOptions(res.data.data.map((m) => ({ label: m, value: m })));
        } else {
          setModelOptions([]);
        }
      })
      .catch(() => setModelOptions([]));
  }, [visible]);

  const submit = async (values) => {
    if (!values.title || values.title.trim() === '') {
      showError(t('套餐标题不能为空'));
      return;
    }
    if (
      !values.daily_enabled &&
      !values.weekly_enabled &&
      !values.monthly_enabled
    ) {
      showError(t('至少需要启用一个额度桶（日/周/月）'));
      return;
    }
    if (Number(values.validity_months || 0) < 1) {
      showError(t('请输入有效期月数'));
      return;
    }
    setLoading(true);
    try {
      const payload = {
        plan: {
          ...values,
          price_amount: Number(values.price_amount || 0),
          currency: 'USD',
          duration_unit: 'month',
          duration_value: Number(values.validity_months || 1),
          custom_seconds: 0,
          quota_reset_period: 'never',
          quota_reset_custom_seconds: 0,
          sort_order: Number(values.sort_order || 0),
          max_purchase_per_user: Number(values.max_purchase_per_user || 0),
          total_amount: 0,
          daily_enabled: !!values.daily_enabled,
          weekly_enabled: !!values.weekly_enabled,
          monthly_enabled: !!values.monthly_enabled,
          daily_limit: displayAmountToQuota(values.daily_limit),
          weekly_limit: displayAmountToQuota(values.weekly_limit),
          monthly_limit: displayAmountToQuota(values.monthly_limit),
          validity_months: Number(values.validity_months || 0),
          upgrade_group: values.upgrade_group || '',
          rpm_enabled: !!values.rpm_enabled,
          rpm_limit: Number(values.rpm_limit || 0),
          model_limits_enabled: !!values.model_limits_enabled,
          model_limits: Array.isArray(values.model_limits)
            ? values.model_limits.join(',')
            : values.model_limits || '',
          description: values.description || '',
          price_ratio: Number(values.price_ratio) > 0 ? Number(values.price_ratio) : 1,
        },
      };
      if (editingPlan?.plan?.id) {
        const res = await API.put(
          `/api/subscription/admin/plans/${editingPlan.plan.id}`,
          payload,
        );
        if (res.data?.success) {
          showSuccess(t('更新成功'));
          handleClose();
          refresh?.();
        } else {
          showError(res.data?.message || t('更新失败'));
        }
      } else {
        const res = await API.post('/api/subscription/admin/plans', payload);
        if (res.data?.success) {
          showSuccess(t('创建成功'));
          handleClose();
          refresh?.();
        } else {
          showError(res.data?.message || t('创建失败'));
        }
      }
    } catch (e) {
      showError(t('请求失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SideSheet
        placement={placement}
        title={
          <Space>
            {isEdit ? (
              <Tag color='blue' shape='circle'>
                {t('更新')}
              </Tag>
            ) : (
              <Tag color='green' shape='circle'>
                {t('新建')}
              </Tag>
            )}
            <Title heading={4} className='m-0'>
              {isEdit ? t('更新套餐信息') : t('创建新的订阅套餐')}
            </Title>
          </Space>
        }
        bodyStyle={{ padding: '0' }}
        visible={visible}
        width={isMobile ? '100%' : 600}
        footer={
          <div className='flex justify-end bg-white'>
            <Space>
              <Button
                theme='solid'
                onClick={() => formApiRef.current?.submitForm()}
                icon={<IconSave />}
                loading={loading}
              >
                {t('提交')}
              </Button>
              <Button
                theme='light'
                type='primary'
                onClick={handleClose}
                icon={<IconClose />}
              >
                {t('取消')}
              </Button>
            </Space>
          </div>
        }
        closeIcon={null}
        onCancel={handleClose}
      >
        <Spin spinning={loading}>
          <Form
            key={formKey}
            initValues={buildFormValues()}
            getFormApi={(api) => (formApiRef.current = api)}
            onSubmit={submit}
          >
            {({ values }) => (
              <div className='p-2'>
                {/* 基本信息 */}
                <Card className='!rounded-2xl shadow-sm border-0 mb-4'>
                  <div className='flex items-center mb-2'>
                    <Avatar
                      size='small'
                      color='blue'
                      className='mr-2 shadow-md'
                    >
                      <IconCalendarClock size={16} />
                    </Avatar>
                    <div>
                      <Text className='text-lg font-medium'>
                        {t('基本信息')}
                      </Text>
                      <div className='text-xs text-gray-600'>
                        {t('套餐的基本信息和定价')}
                      </div>
                    </div>
                  </div>

                  <Row gutter={12}>
                    <Col span={24}>
                      <Form.Input
                        field='title'
                        label={t('套餐标题')}
                        placeholder={t('例如：基础套餐')}
                        required
                        rules={[
                          { required: true, message: t('请输入套餐标题') },
                        ]}
                        showClear
                      />
                    </Col>

                    <Col span={24}>
                      <Form.Input
                        field='subtitle'
                        label={t('套餐副标题')}
                        placeholder={t('例如：适合轻度使用')}
                        showClear
                      />
                    </Col>

                    <Col span={12}>
                      <Form.InputNumber
                        field='price_amount'
                        label={t('实付金额')}
                        required
                        min={0}
                        precision={2}
                        rules={[{ required: true, message: t('请输入金额') }]}
                        style={{ width: '100%' }}
                      />
                    </Col>

                    <Col span={12}>
                      <Form.Select
                        field='upgrade_group'
                        label={t('升级分组')}
                        showClear
                        loading={groupLoading}
                        placeholder={t('不升级')}
                        extraText={t(
                          '购买或手动新增订阅会升级到该分组；当套餐失效/过期或手动作废/删除后，将回退到升级前分组。回退不会立即生效，通常会有几分钟延迟。',
                        )}
                      >
                        <Select.Option value=''>{t('不升级')}</Select.Option>
                        {(groupOptions || []).map((g) => (
                          <Select.Option key={g} value={g}>
                            {g}
                          </Select.Option>
                        ))}
                      </Form.Select>
                    </Col>

                    <Col span={12}>
                      <Form.Input
                        field='currency'
                        label={t('币种')}
                        disabled
                        extraText={t('由全站货币展示设置统一控制')}
                      />
                    </Col>

                    <Col span={12}>
                      <Form.InputNumber
                        field='sort_order'
                        label={t('排序')}
                        precision={0}
                        style={{ width: '100%' }}
                      />
                    </Col>

                    <Col span={12}>
                      <Form.InputNumber
                        field='max_purchase_per_user'
                        label={t('购买上限')}
                        min={0}
                        precision={0}
                        extraText={t('0 表示不限')}
                        style={{ width: '100%' }}
                      />
                    </Col>

                    <Col span={12}>
                      <Form.InputNumber
                        field='validity_months'
                        label={t('有效期（月）')}
                        required
                        min={1}
                        precision={0}
                        rules={[
                          { required: true, message: t('请输入有效期月数') },
                        ]}
                        extraText={t('按 30 天/月计算')}
                        style={{ width: '100%' }}
                      />
                    </Col>

                    <Col span={24}>
                      <div style={{ fontWeight: 600, margin: '4px 0' }}>
                        {t('额度桶（至少启用一个）')}
                      </div>
                    </Col>

                    <Col span={8}>
                      <Form.Switch
                        field='daily_enabled'
                        label={t('启用日额度')}
                      />
                    </Col>
                    <Col span={16}>
                      {values.daily_enabled && (
                        <Form.InputNumber
                          field='daily_limit'
                          label={t('日限额')}
                          min={0}
                          precision={2}
                          extraText={`${t('原生额度')}：${displayAmountToQuota(
                            values.daily_limit,
                          )} · ${t('每 24 小时重置')}`}
                          style={{ width: '100%' }}
                        />
                      )}
                    </Col>

                    <Col span={8}>
                      <Form.Switch
                        field='weekly_enabled'
                        label={t('启用周额度')}
                      />
                    </Col>
                    <Col span={16}>
                      {values.weekly_enabled && (
                        <Form.InputNumber
                          field='weekly_limit'
                          label={t('周限额')}
                          min={0}
                          precision={2}
                          extraText={`${t('原生额度')}：${displayAmountToQuota(
                            values.weekly_limit,
                          )} · ${t('每 7 天重置')}`}
                          style={{ width: '100%' }}
                        />
                      )}
                    </Col>

                    <Col span={8}>
                      <Form.Switch
                        field='monthly_enabled'
                        label={t('启用月额度')}
                      />
                    </Col>
                    <Col span={16}>
                      {values.monthly_enabled && (
                        <Form.InputNumber
                          field='monthly_limit'
                          label={t('月限额')}
                          min={0}
                          precision={2}
                          extraText={`${t('原生额度')}：${displayAmountToQuota(
                            values.monthly_limit,
                          )} · ${t('每 30 天重置')}`}
                          style={{ width: '100%' }}
                        />
                      )}
                    </Col>

                    <Col span={12}>
                      <Form.Switch
                        field='enabled'
                        label={t('启用状态')}
                        size='large'
                      />
                    </Col>
                  </Row>
                </Card>

                {/* 访问控制：RPM + 模型限制 + 描述 */}
                <Card className='!rounded-2xl shadow-sm border-0 mb-4'>
                  <div className='flex items-center mb-2'>
                    <Avatar
                      size='small'
                      color='orange'
                      className='mr-2 shadow-md'
                    >
                      <Clock size={16} />
                    </Avatar>
                    <div>
                      <Text className='text-lg font-medium'>
                        {t('访问控制与描述')}
                      </Text>
                      <div className='text-xs text-gray-600'>
                        {t('套餐级速率限制、模型白名单与展示描述')}
                      </div>
                    </div>
                  </div>

                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Switch
                        field='rpm_enabled'
                        label={t('启用每分钟请求限制 (RPM)')}
                      />
                    </Col>
                    <Col span={12}>
                      {values.rpm_enabled && (
                        <Form.InputNumber
                          field='rpm_limit'
                          label={t('每分钟请求次数')}
                          min={0}
                          precision={0}
                          extraText={t('0 表示不限制')}
                          style={{ width: '100%' }}
                        />
                      )}
                    </Col>

                    <Col span={24}>
                      <Form.InputNumber
                        field='price_ratio'
                        label={t('计费倍率')}
                        min={0.01}
                        max={100}
                        step={0.1}
                        precision={2}
                        extraText={t('模型实际价格 = 模型价格 × 倍率（默认 1，不缩放）')}
                        style={{ width: '100%' }}
                      />
                    </Col>

                    <Col span={24}>
                      <Form.Switch
                        field='model_limits_enabled'
                        label={t('启用模型限制列表')}
                      />
                    </Col>
                    <Col span={24}>
                      {values.model_limits_enabled && (
                        <Form.Select
                          field='model_limits'
                          label={t('允许使用的模型')}
                          multiple
                          filter
                          allowAdditions
                          placeholder={t('选择或输入允许的模型，留空表示不允许任何模型')}
                          optionList={modelOptions}
                          style={{ width: '100%' }}
                        />
                      )}
                    </Col>

                    <Col span={24}>
                      <Form.TextArea
                        field='description'
                        label={t('套餐描述')}
                        autosize={{ minRows: 3, maxRows: 8 }}
                        placeholder={t('用于前端展示的套餐说明，支持多行文本')}
                        showClear
                      />
                    </Col>
                  </Row>
                </Card>

                {/* 第三方支付配置 */}
                <Card className='!rounded-2xl shadow-sm border-0 mb-4'>
                  <div className='flex items-center mb-2'>
                    <Avatar
                      size='small'
                      color='purple'
                      className='mr-2 shadow-md'
                    >
                      <IconCreditCard size={16} />
                    </Avatar>
                    <div>
                      <Text className='text-lg font-medium'>
                        {t('第三方支付配置')}
                      </Text>
                      <div className='text-xs text-gray-600'>
                        {t('Stripe/Creem 商品ID（可选）')}
                      </div>
                    </div>
                  </div>

                  <Row gutter={12}>
                    <Col span={24}>
                      <Form.Input
                        field='stripe_price_id'
                        label='Stripe PriceId'
                        placeholder='price_...'
                        showClear
                      />
                    </Col>

                    <Col span={24}>
                      <Form.Input
                        field='creem_product_id'
                        label='Creem ProductId'
                        placeholder='prod_...'
                        showClear
                      />
                    </Col>
                  </Row>
                </Card>
              </div>
            )}
          </Form>
        </Spin>
      </SideSheet>
    </>
  );
};

export default AddEditSubscriptionModal;
