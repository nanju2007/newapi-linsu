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

import React from 'react';
import { Modal, Typography, Input, InputNumber } from '@douyinfe/semi-ui';
import { CreditCard } from 'lucide-react';
import {
  quotaToDisplayAmount,
  displayAmountToQuota,
} from '../../../helpers/quota';
import { getCurrencyConfig } from '../../../helpers/render';

const TransferModal = ({
  t,
  openTransfer,
  transfer,
  handleTransferCancel,
  userState,
  renderQuota,
  getQuotaPerUnit,
  transferAmount,
  setTransferAmount,
}) => {
  const { type, symbol } = getCurrencyConfig();
  const isTokenMode = type === 'TOKENS';

  // 可划转额度上限（以当前展示单位计）
  const maxQuota = userState?.user?.aff_quota || 0;
  const maxDisplay = quotaToDisplayAmount(maxQuota);
  // 最低划转额度：1 个 quota 单位（如 500000 token = 1 美元）对应的展示金额
  const minDisplay = quotaToDisplayAmount(getQuotaPerUnit());
  // 当前输入框展示值：将内部 quota 换算为展示单位
  const displayValue = quotaToDisplayAmount(transferAmount);
  // 非 token 模式下按货币单位步进，token 模式保持整数步进
  const step = isTokenMode ? getQuotaPerUnit() : 0.01;

  return (
    <Modal
      title={
        <div className='flex items-center'>
          <CreditCard className='mr-2' size={18} />
          {t('划转邀请额度')}
        </div>
      }
      visible={openTransfer}
      onOk={transfer}
      onCancel={handleTransferCancel}
      maskClosable={false}
      centered
    >
      <div className='space-y-4'>
        <div>
          <Typography.Text strong className='block mb-2'>
            {t('可用邀请额度')}
          </Typography.Text>
          <Input
            value={renderQuota(userState?.user?.aff_quota)}
            disabled
            className='!rounded-lg'
          />
        </div>
        <div>
          <Typography.Text strong className='block mb-2'>
            {t('划转额度')} · {t('最低') + renderQuota(getQuotaPerUnit())}
          </Typography.Text>
          <InputNumber
            min={minDisplay}
            max={maxDisplay}
            step={step}
            value={displayValue}
            prefix={isTokenMode ? undefined : symbol}
            // 用户按当前展示单位（元/美元/自定义）输入，内部换算回 quota 提交
            onChange={(value) => setTransferAmount(displayAmountToQuota(value))}
            className='w-full !rounded-lg'
          />
        </div>
      </div>
    </Modal>
  );
};

export default TransferModal;
