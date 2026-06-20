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

import React, { useEffect, useRef } from 'react';

/**
 * 将极验验证结果拼接为后端二次校验所需的 query string。
 * 返回形如 "&lot_number=xxx&captcha_output=xxx&pass_token=xxx&gen_time=xxx"，
 * 当 result 为空时返回空串。
 */
export function buildGeetestQuery(result) {
  if (!result) {
    return '';
  }
  const params = ['lot_number', 'captcha_output', 'pass_token', 'gen_time'];
  return params
    .map((key) =>
      result[key] !== undefined && result[key] !== null
        ? `&${key}=${encodeURIComponent(result[key])}`
        : '',
    )
    .join('');
}

const GEETEST_SCRIPT_SRC = 'https://static.geetest.com/v4/gt4.js';
const GEETEST_SCRIPT_ID = 'geetest-v4-script';

/**
 * 加载极验 gt4.js 脚本，确保全局只加载一次。
 */
function loadGeetestScript() {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.initGeetest4) {
      resolve();
      return;
    }

    const existing = document.getElementById(GEETEST_SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () =>
        reject(new Error('Failed to load gt4.js')),
      );
      return;
    }

    const script = document.createElement('script');
    script.id = GEETEST_SCRIPT_ID;
    script.src = GEETEST_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load gt4.js'));
    document.head.appendChild(script);
  });
}

/**
 * 极验行为验证 4.0 组件（浮动式 float）。
 *
 * Props:
 * - captchaId: 极验后台申请的验证 ID（必填）
 * - onSuccess(result): 验证成功回调，result 为 captchaObj.getValidate() 的结果，
 *   包含 lot_number / captcha_output / pass_token / gen_time。
 * - onError(error): 验证出错回调（可选）。
 */
const GeetestCaptcha = ({ captchaId, onSuccess, onError }) => {
  const containerRef = useRef(null);
  const captchaObjRef = useRef(null);
  const handlersRef = useRef({ onSuccess, onError });
  handlersRef.current = { onSuccess, onError };

  useEffect(() => {
    let cancelled = false;

    if (!captchaId) {
      return undefined;
    }

    loadGeetestScript()
      .then(() => {
        if (cancelled || !window.initGeetest4) {
          return;
        }

        window.initGeetest4(
          {
            captchaId,
            product: 'popup',
            nativeButton: {
              width: '100%',
              height: '40px',
            },
            mask: {
              outside: false,
              bgColor: '#0000004d',
            },
          },
          (captchaObj) => {
            if (cancelled) {
              try {
                captchaObj.destroy();
              } catch (e) {
                // ignore destroy error
              }
              return;
            }

            captchaObjRef.current = captchaObj;

            if (containerRef.current) {
              captchaObj.appendTo(containerRef.current);
            }

            captchaObj
              .onSuccess(() => {
                const result = captchaObj.getValidate();
                if (result && typeof handlersRef.current.onSuccess === 'function') {
                  handlersRef.current.onSuccess(result);
                }
              })
              .onError((error) => {
                if (typeof handlersRef.current.onError === 'function') {
                  handlersRef.current.onError(error);
                }
              });
          },
        );
      })
      .catch((error) => {
        if (!cancelled && typeof onError === 'function') {
          onError(error);
        }
      });

    return () => {
      cancelled = true;
      if (captchaObjRef.current) {
        try {
          captchaObjRef.current.destroy();
        } catch (e) {
          // ignore destroy error
        }
        captchaObjRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captchaId]);

  return <div ref={containerRef} className='geetest-captcha-wrapper w-full' />;
};

export default GeetestCaptcha;
