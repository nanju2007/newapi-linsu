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

import React, { useRef } from 'react';
import { Modal, Button } from '@douyinfe/semi-ui';
import { Printer } from 'lucide-react';
import { timestamp2string } from '../../../helpers';

// ReceiptModal 正规发票/Invoice 弹窗。模仿标准托管商发票排版：
// 公司抬头 + PAID 角标 + 发票号 + 开票对象 + 明细表 + 小计/合计 + 交易记录。
// 收据数据来源于已有充值记录，不引入额外数据表。
const ReceiptModal = ({ t, visible, onCancel, record }) => {
  const printRef = useRef(null);

  if (!record) return null;

  const siteName = localStorage.getItem('system_name') || 'New API';
  const logo = localStorage.getItem('logo') || '';
  const isPaid = record.status === 'success';

  const money = Number(record.money || 0);
  const moneyStr = `¥${money.toFixed(2)}`;
  const issueDate = timestamp2string(record.complete_time || record.create_time);
  const tradeNo = record.trade_no || '-';
  const shortInvoiceNo = String(record.id || tradeNo);

  // 仅打印收据区域：复制节点内容到新窗口打印，避免打印整页后台界面。
  const handlePrint = () => {
    const node = printRef.current;
    if (!node) {
      window.print();
      return;
    }
    const win = window.open('', '_blank', 'width=900,height=1000');
    if (!win) {
      window.print();
      return;
    }
    win.document.write(`<!DOCTYPE html><html><head><title>Invoice ${shortInvoiceNo}</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, "Helvetica Neue", Helvetica, sans-serif; color: #1f2937; margin: 0; padding: 32px; }
        ${INVOICE_CSS}
      </style></head><body>${node.innerHTML}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 300);
  };

  return (
    <Modal
      title={t('收据')}
      visible={visible}
      onCancel={onCancel}
      width={760}
      footer={
        <Button
          theme='solid'
          type='primary'
          icon={<Printer size={14} />}
          onClick={handlePrint}
        >
          {t('打印收据')}
        </Button>
      }
      centered
    >
      <style>{INVOICE_CSS}</style>
      <div ref={printRef}>
        <div className='invoice-wrap'>
          {isPaid && <div className='invoice-ribbon'>PAID</div>}

          {/* 抬头：Logo + 公司信息 */}
          <div className='invoice-header'>
            <div className='invoice-brand'>
              {logo ? (
                <img src={logo} alt={siteName} className='invoice-logo' />
              ) : null}
              <span className='invoice-brand-name'>{siteName}</span>
            </div>
            <div className='invoice-company'>
              <div className='invoice-company-name'>{siteName}</div>
              <div>{t('开票方')}: {siteName}</div>
              <div>{t('账单系统自动开具')}</div>
            </div>
          </div>

          {/* 发票号灰框 */}
          <div className='invoice-titlebox'>
            <div className='invoice-no'>Invoice #{shortInvoiceNo}</div>
            <div className='invoice-date'>{t('开具时间')}: {issueDate}</div>
            <div className='invoice-date'>{t('订单号')}: {tradeNo}</div>
          </div>

          {/* 开票对象 */}
          <div className='invoice-billto'>
            <div className='invoice-billto-title'>{t('开票对象')}</div>
            <div>{t('用户ID')}: {record.user_id}</div>
          </div>

          {/* 明细表 */}
          <table className='invoice-table'>
            <thead>
              <tr>
                <th className='left'>{t('项目说明')}</th>
                <th className='right'>{t('金额')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className='left'>
                  {t('账户额度充值')}（{record.amount} {t('额度')}）
                  <div className='invoice-subtext'>
                    {t('支付方式')}: {record.payment_method || '-'}
                  </div>
                </td>
                <td className='right'>{moneyStr}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td className='right label'>{t('小计')}</td>
                <td className='right'>{moneyStr}</td>
              </tr>
              <tr>
                <td className='right label'>{t('合计')}</td>
                <td className='right total'>{moneyStr}</td>
              </tr>
            </tfoot>
          </table>

          {/* 交易记录 */}
          <div className='invoice-section-title'>{t('交易记录')}</div>
          <table className='invoice-table'>
            <thead>
              <tr>
                <th className='center'>{t('交易时间')}</th>
                <th className='center'>{t('支付方式')}</th>
                <th className='center'>{t('订单号')}</th>
                <th className='center'>{t('金额')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className='center'>{issueDate}</td>
                <td className='center'>{record.payment_method || '-'}</td>
                <td className='center'>{tradeNo}</td>
                <td className='center'>{moneyStr}</td>
              </tr>
              <tr>
                <td className='right label' colSpan={3}>
                  {t('余额')}
                </td>
                <td className='center total'>¥0.00</td>
              </tr>
            </tbody>
          </table>

          <div className='invoice-footer'>
            {t('收据生成时间')}: {timestamp2string(Math.floor(Date.now() / 1000))}
          </div>
        </div>
      </div>
    </Modal>
  );
};

// 发票样式（同时用于弹窗预览与打印窗口）
const INVOICE_CSS = `
.invoice-wrap {
  position: relative;
  background: #fff;
  padding: 28px 28px 20px;
  overflow: hidden;
  color: #1f2937;
}
.invoice-ribbon {
  position: absolute;
  top: 26px;
  right: -52px;
  width: 200px;
  transform: rotate(45deg);
  background: #84cc16;
  color: #fff;
  text-align: center;
  font-weight: 700;
  letter-spacing: 3px;
  padding: 6px 0;
  font-size: 18px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.15);
}
.invoice-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 28px;
}
.invoice-brand { display: flex; align-items: center; gap: 10px; }
.invoice-logo { height: 40px; width: auto; }
.invoice-brand-name { font-size: 24px; font-weight: 700; color: #1d4ed8; }
.invoice-company { text-align: right; font-size: 12px; color: #4b5563; line-height: 1.6; }
.invoice-company-name { font-size: 15px; font-weight: 700; color: #111827; }
.invoice-titlebox {
  background: #f3f4f6;
  padding: 14px 16px;
  border-radius: 4px;
  margin-bottom: 20px;
}
.invoice-no { font-size: 18px; font-weight: 700; margin-bottom: 6px; }
.invoice-date { font-size: 12px; color: #4b5563; }
.invoice-billto { margin-bottom: 18px; font-size: 13px; line-height: 1.7; }
.invoice-billto-title { font-weight: 700; margin-bottom: 4px; }
.invoice-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 24px;
  font-size: 13px;
}
.invoice-table th {
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  padding: 8px 12px;
  font-weight: 700;
}
.invoice-table td {
  border: 1px solid #e5e7eb;
  padding: 8px 12px;
}
.invoice-table .left { text-align: left; }
.invoice-table .right { text-align: right; }
.invoice-table .center { text-align: center; }
.invoice-table .label { font-weight: 700; background: #fafafa; }
.invoice-table .total { font-weight: 700; }
.invoice-subtext { font-size: 11px; color: #6b7280; margin-top: 4px; }
.invoice-section-title { font-size: 15px; font-weight: 700; margin: 4px 0 10px; }
.invoice-footer { text-align: center; font-size: 11px; color: #9ca3af; margin-top: 18px; }
`;

export default ReceiptModal;
