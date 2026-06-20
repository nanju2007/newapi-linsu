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

import React, { useState } from 'react';
import {
  Modal,
  Typography,
  Input,
  InputNumber,
  Select,
} from '@douyinfe/semi-ui';
import { Wallet } from 'lucide-react';
import { API, showError, showSuccess } from '../../../helpers';
import {
  quotaToDisplayAmount,
  displayAmountToQuota,
  getQuotaPerUnit,
} from '../../../helpers/quota';
import { getCurrencyConfig } from '../../../helpers/render';

const WithdrawalModal = ({
  t,
  visible,
  onCancel,
  onSuccess,
  userState,
  renderQuota,
}) => {
  const { type, symbol } = getCurrencyConfig();
  const isTokenMode = type === 'TOKENS';

  const maxQuota = userState?.user?.aff_quota || 0;
  const maxDisplay = quotaToDisplayAmount(maxQuota);
  const minDisplay = quotaToDisplayAmount(getQuotaPerUnit());

  const [amount, setAmount] = useState(minDisplay);
  const [accountType, setAccountType] = useState('alipay');
  const [accountInfo, setAccountInfo] = useState('');
  const [realName, setRealName] = useState('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const quota = displayAmountToQuota(amount);
    if (quota < getQuotaPerUnit()) {
      showError(t('提现金额最低为') + ' ' + renderQuota(getQuotaPerUnit()));
      return;
    }
    if (quota > maxQuota) {
      showError(t('提现金额超过可用邀请额度'));
      return;
    }
    if (!accountInfo) {
      showError(t('请填写收款账号'));
      return;
    }
    setLoading(true);
    try {
      const res = await API.post('/api/user/withdrawal', {
        quota,
        account_type: accountType,
        account_info: accountInfo,
        real_name: realName,
        comment,
      });
      if (res.data.success) {
        showSuccess(t('提现申请已提交，请等待管理员审核'));
        onSuccess && onSuccess();
        onCancel && onCancel();
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(t('提现申请提交失败'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <div className='flex items-center'>
          <Wallet className='mr-2' size={18} />
          {t('申请提现')}
        </div>
      }
      visible={visible}
      onOk={submit}
      onCancel={onCancel}
      confirmLoading={loading}
      maskClosable={false}
      centered
    >
      <div className='space-y-4'>
        <div>
          <Typography.Text strong className='block mb-2'>
            {t('可提现邀请额度')}
          </Typography.Text>
          <Input
            value={renderQuota(maxQuota)}
            disabled
            className='!rounded-lg'
          />
        </div>
        <div>
          <Typography.Text strong className='block mb-2'>
            {t('提现金额')} · {t('最低') + renderQuota(getQuotaPerUnit())}
          </Typography.Text>
          <InputNumber
            min={minDisplay}
            max={maxDisplay}
            step={isTokenMode ? getQuotaPerUnit() : 0.01}
            value={amount}
            prefix={isTokenMode ? undefined : symbol}
            onChange={(value) => setAmount(value)}
            className='w-full !rounded-lg'
          />
        </div>
        <div>
          <Typography.Text strong className='block mb-2'>
            {t('收款方式')}
          </Typography.Text>
          <Select
            value={accountType}
            onChange={(value) => setAccountType(value)}
            className='w-full'
          >
            <Select.Option value='alipay'>{t('支付宝')}</Select.Option>
            <Select.Option value='wechat'>{t('微信')}</Select.Option>
            <Select.Option value='bank'>{t('银行卡')}</Select.Option>
            <Select.Option value='usdt'>{t('USDT')}</Select.Option>
          </Select>
        </div>
        <div>
          <Typography.Text strong className='block mb-2'>
            {t('收款账号')}
          </Typography.Text>
          <Input
            value={accountInfo}
            onChange={(value) => setAccountInfo(value)}
            placeholder={t('请输入收款账号')}
            className='!rounded-lg'
          />
        </div>
        <div>
          <Typography.Text strong className='block mb-2'>
            {t('收款人姓名')}
          </Typography.Text>
          <Input
            value={realName}
            onChange={(value) => setRealName(value)}
            placeholder={t('请输入收款人姓名')}
            className='!rounded-lg'
          />
        </div>
        <div>
          <Typography.Text strong className='block mb-2'>
            {t('备注')}
          </Typography.Text>
          <Input
            value={comment}
            onChange={(value) => setComment(value)}
            placeholder={t('选填')}
            className='!rounded-lg'
          />
        </div>
      </div>
    </Modal>
  );
};

export default WithdrawalModal;
