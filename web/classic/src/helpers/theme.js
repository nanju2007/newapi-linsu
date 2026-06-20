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

// 网站主题色管理
// - 内置多套预设色调（default 为 newapi 默认白底蓝色）
// - 支持管理员自定义主色（HEX）
// 通过向 <head> 注入受管 <style> 节点的方式覆盖 Semi 的 --semi-color-primary 系列变量，
// 同时兼容亮/暗色模式（主色 hue 一致，仅需覆盖 primary 家族）。

const STYLE_TAG_ID = 'app-theme-color-vars';

// 内置预设：key -> 主色 HEX。default 为空表示使用 Semi 默认（newapi 经典蓝/白）。
export const THEME_PRESETS = {
  default: { label: '默认（经典白）', primary: '' },
  blue: { label: '蓝色', primary: '#2563eb' },
  violet: { label: '紫色', primary: '#6d28d9' },
  teal: { label: '青色', primary: '#0f766e' },
  green: { label: '绿色', primary: '#047857' },
  rose: { label: '玫红', primary: '#be123c' },
  amber: { label: '琥珀', primary: '#b45309' },
  warm: { label: '暖陶（Anthropic）', primary: '#c15f3c' },
};

function clamp(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function hexToRgb(hex) {
  if (!hex) return null;
  let h = hex.trim().replace('#', '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

// 与黑色混合使颜色变暗，ratio 0~1
function darken({ r, g, b }, ratio) {
  return {
    r: clamp(r * (1 - ratio)),
    g: clamp(g * (1 - ratio)),
    b: clamp(b * (1 - ratio)),
  };
}

// 与白色混合使颜色变亮，ratio 0~1
function lighten({ r, g, b }, ratio) {
  return {
    r: clamp(r + (255 - r) * ratio),
    g: clamp(g + (255 - g) * ratio),
    b: clamp(b + (255 - b) * ratio),
  };
}

function rgbStr({ r, g, b }) {
  return `rgb(${r}, ${g}, ${b})`;
}

function rgbaStr({ r, g, b }, alpha) {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// 根据主色生成 Semi primary 家族变量
function buildVars(rgb, dark) {
  const hover = dark ? lighten(rgb, 0.12) : darken(rgb, 0.12);
  const active = dark ? lighten(rgb, 0.22) : darken(rgb, 0.22);
  const disabled = lighten(rgb, dark ? -0.2 : 0.55);
  const lightAlpha = dark ? [0.14, 0.22, 0.3] : [0.08, 0.15, 0.22];
  return {
    '--semi-color-primary': rgbStr(rgb),
    '--semi-color-primary-hover': rgbStr(hover),
    '--semi-color-primary-active': rgbStr(active),
    '--semi-color-primary-disabled': rgbStr(disabled),
    '--semi-color-primary-light-default': rgbaStr(rgb, lightAlpha[0]),
    '--semi-color-primary-light-hover': rgbaStr(rgb, lightAlpha[1]),
    '--semi-color-primary-light-active': rgbaStr(rgb, lightAlpha[2]),
    '--semi-color-link': rgbStr(rgb),
    '--semi-color-link-hover': rgbStr(hover),
    '--semi-color-link-active': rgbStr(active),
    '--semi-color-link-visited': rgbStr(rgb),
  };
}

function varsToCss(vars) {
  return Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n');
}

function removeStyleTag() {
  const el = document.getElementById(STYLE_TAG_ID);
  if (el) el.remove();
}

/**
 * 解析主题配置，返回最终生效的主色 HEX（空字符串表示使用 Semi 默认）。
 */
export function resolveThemePrimary(preset, customColor) {
  const custom = (customColor || '').trim();
  if (custom && hexToRgb(custom)) {
    return custom;
  }
  const p = THEME_PRESETS[preset];
  return p ? p.primary : '';
}

/**
 * 应用主题色：注入/更新受管 <style>。
 * @param {string} preset 预设名
 * @param {string} customColor 自定义 HEX，优先级高于预设
 */
export function applyThemeColor(preset, customColor) {
  const finalHex = resolveThemePrimary(preset, customColor);

  // 空 -> 使用 Semi 默认（newapi 经典白），移除受管样式即可
  if (!finalHex) {
    removeStyleTag();
    return;
  }

  const rgb = hexToRgb(finalHex);
  if (!rgb) {
    removeStyleTag();
    return;
  }

  const lightCss = varsToCss(buildVars(rgb, false));
  const darkCss = varsToCss(buildVars(rgb, true));

  // Semi UI 把 --semi-color-* 变量定义在 body 上，因此必须覆盖到 body（及暗色作用域），
  // 仅覆盖 :root 会被 body 的同名变量遮蔽，导致主题色不生效。
  const css =
    `:root,\nbody {\n${lightCss}\n}\n` +
    `html.dark,\nhtml.dark body,\nbody[theme-mode='dark'] {\n${darkCss}\n}`;

  let el = document.getElementById(STYLE_TAG_ID);
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_TAG_ID;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

/**
 * 从 status 数据应用主题色（localStorage 中缓存的 status 也可用）。
 */
export function applyThemeFromStatus(status) {
  if (!status) {
    try {
      status = JSON.parse(localStorage.getItem('status') || '{}');
    } catch (e) {
      status = {};
    }
  }
  applyThemeColor(status.theme_preset, status.theme_primary_color);
}
