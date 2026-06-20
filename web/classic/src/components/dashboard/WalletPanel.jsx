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

import React, { useContext, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@douyinfe/semi-ui';
import {
  Wallet,
  Gift,
  Plus,
  Rocket,
  KeyRound,
  BarChart3,
  LifeBuoy,
  ChevronRight,
} from 'lucide-react';
import { UserContext } from '../../context/User';
import { renderQuota } from '../../helpers/render';

const WalletPanel = ({ t }) => {
  const navigate = useNavigate();
  const [userState] = useContext(UserContext);
  const user = userState?.user || {};

  const balanceText = useMemo(
    () => renderQuota(user.quota || 0, 2),
    [user.quota],
  );
  const affBalanceText = useMemo(
    () => renderQuota(user.aff_quota || 0, 2),
    [user.aff_quota],
  );

  const quickLinks = [
    {
      key: 'topup',
      icon: <Rocket size={18} />,
      label: t('充值中心'),
      onClick: () => navigate('/console/topup'),
    },
    {
      key: 'token',
      icon: <KeyRound size={18} />,
      label: t('API 令牌'),
      onClick: () => navigate('/console/token'),
    },
    {
      key: 'log',
      icon: <BarChart3 size={18} />,
      label: t('使用日志'),
      onClick: () => navigate('/console/log'),
    },
    {
      key: 'ticket',
      icon: <LifeBuoy size={18} />,
      label: t('工单中心'),
      onClick: () => navigate('/console/ticket'),
    },
  ];

  return (
    <div className='flex flex-col gap-4'>
      {/* 钱包卡片 */}
      <Card
        className='!rounded-2xl border-0 shadow-sm overflow-hidden'
        bodyStyle={{ padding: 0 }}
      >
        <div className='p-5'>
          <div className='flex items-center gap-2 mb-4 text-gray-700 dark:text-gray-200'>
            <Wallet size={18} />
            <span className='font-semibold'>{t('我的钱包')}</span>
          </div>
          <div className='text-3xl font-bold text-gray-900 dark:text-gray-50 mb-1'>
            {balanceText}
          </div>
          <div className='text-xs text-gray-400 mb-4'>{t('当前余额')}</div>

          <div className='border-t border-gray-100 dark:border-gray-700 pt-4'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2 text-gray-500 dark:text-gray-400'>
                <Gift size={16} />
                <span className='text-sm'>{t('推广奖励（可提现）')}</span>
              </div>
              <button
                type='button'
                onClick={() => navigate('/console/topup')}
                className='text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400'
              >
                {t('去邀请')}
              </button>
            </div>
            <div className='text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1'>
              {affBalanceText}
            </div>
          </div>

          <button
            type='button'
            onClick={() => navigate('/console/topup')}
            className='mt-5 w-full flex items-center justify-center gap-2 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors'
          >
            <Plus size={18} />
            {t('立即充值')}
          </button>
        </div>
      </Card>

      {/* 快速开始卡片 */}
      <Card
        className='!rounded-2xl border-0 shadow-sm overflow-hidden'
        bodyStyle={{ padding: 0 }}
      >
        <div className='p-5'>
          <div className='flex items-center gap-2 mb-3 text-gray-700 dark:text-gray-200'>
            <Rocket size={18} />
            <span className='font-semibold'>{t('快速开始')}</span>
          </div>
          <div className='flex flex-col'>
            {quickLinks.map((link) => (
              <button
                key={link.key}
                type='button'
                onClick={link.onClick}
                className='flex items-center justify-between py-3 px-2 -mx-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left'
              >
                <span className='flex items-center gap-3 text-gray-700 dark:text-gray-200'>
                  <span className='text-blue-500'>{link.icon}</span>
                  <span className='text-sm'>{link.label}</span>
                </span>
                <ChevronRight size={16} className='text-gray-300' />
              </button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default WalletPanel;
