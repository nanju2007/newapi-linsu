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
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Wallet, KeyRound, User, Menu } from 'lucide-react';

const MobileTabBar = ({ onMenuClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const tabs = [
    {
      key: 'console',
      icon: LayoutDashboard,
      label: t('仪表盘'),
      path: '/console',
      match: (p) => p === '/console',
    },
    {
      key: 'topup',
      icon: Wallet,
      label: t('钱包'),
      path: '/console/topup',
      match: (p) => p.startsWith('/console/topup'),
    },
    {
      key: 'token',
      icon: KeyRound,
      label: t('令牌'),
      path: '/console/token',
      match: (p) => p.startsWith('/console/token'),
    },
    {
      key: 'personal',
      icon: User,
      label: t('我的'),
      path: '/console/personal',
      match: (p) => p.startsWith('/console/personal'),
    },
    {
      key: 'menu',
      icon: Menu,
      label: t('更多'),
      action: 'menu',
    },
  ];

  const handleClick = (tab) => {
    if (tab.action === 'menu') {
      onMenuClick?.();
      return;
    }
    navigate(tab.path);
  };

  return (
    <nav className='mobile-tab-bar'>
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = tab.match ? tab.match(location.pathname) : false;
        return (
          <button
            key={tab.key}
            type='button'
            onClick={() => handleClick(tab)}
            className={`mobile-tab-item ${active ? 'mobile-tab-item-active' : ''}`}
          >
            <Icon size={22} strokeWidth={active ? 2.4 : 1.8} />
            <span className='mobile-tab-label'>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default MobileTabBar;
