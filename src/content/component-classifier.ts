import { ComponentType } from '../types/model';

export const COMPONENT_BADGE_COLORS: Record<ComponentType, string> = {
  header: '#3b82f6',
  navbar: '#6366f1',
  footer: '#8b5cf6',
  sidebar: '#a855f7',
  modal: '#a855f7',
  dialog: '#ec4899',
  drawer: '#d946ef',
  dropdown: '#ec4899',
  menu: '#f43f5e',
  table: '#f59e0b',
  tab: '#eab308',
  card: '#64748b',
  form: '#10b981',
  button: '#ef4444',
  link: '#0ea5e9',
  input: '#14b8a6',
  image: '#06b6d4',
  iframe: '#8b5cf6',
  hero: '#3b82f6',
  accordion: '#84cc16',
  tooltip: '#64748b',
  breadcrumb: '#0284c7',
  pagination: '#0ea5e9',
  generic: '#94a3b8',
};

export interface ComponentInfo {
  type: ComponentType;
  hierarchy: string;
  dataFeed?: string;
}

export function inferDataFeed(element: HTMLElement): string | undefined {
  const tag = element.tagName.toLowerCase();
  const type = (element.getAttribute('type') || '').toLowerCase();
  const name = (element.getAttribute('name') || '').toLowerCase();
  const id = (element.getAttribute('id') || '').toLowerCase();
  const placeholder = (element.getAttribute('placeholder') || '').toLowerCase();
  const action = element.closest('form')?.getAttribute('action') || '';

  if (tag === 'input') {
    if (type === 'search' || name.includes('search') || placeholder.includes('search') || id.includes('search')) {
      return 'search_query';
    }
    if (type === 'password' || name.includes('pass') || id.includes('pass') || name.includes('auth')) {
      return 'credentials';
    }
    if (type === 'file') return 'file_upload';
    if (type === 'checkbox' || type === 'radio') return 'boolean_flag';
    if (type === 'email' || name.includes('email')) return 'user_email';
    if (name.includes('filter') || id.includes('filter')) return 'filter';
  }
  if (tag === 'select') return 'selection_value';
  if (tag === 'textarea') return 'text_content';
  if (element.closest('[role="search"]')) return 'search_query';
  if (action.includes('login') || action.includes('auth') || action.includes('signin')) return 'credentials';

  return undefined;
}

export function buildComponentHierarchy(element: HTMLElement): string {
  const parts: string[] = [];
  let current: HTMLElement | null = element;
  let depth = 0;

  while (current && depth < 5) {
    const tag = current.tagName.toLowerCase();
    if (tag === 'body' || tag === 'html') break;

    const role = current.getAttribute('role');
    const id = current.id ? `#${current.id}` : '';
    const className = typeof current.className === 'string' && current.className.trim()
      ? `.${current.className.trim().split(/\s+/)[0]}`
      : '';

    let label = tag;
    if (role) {
      label = `[role="${role}"]`;
    } else if (['header', 'nav', 'footer', 'aside', 'main', 'form', 'table', 'dialog'].includes(tag)) {
      label = tag;
    } else if (id) {
      label = `${tag}${id}`;
    } else if (className) {
      label = `${tag}${className}`;
    }

    parts.unshift(label);
    current = current.parentElement;
    depth++;
  }

  return parts.join(' > ');
}

export function classifyComponent(element: HTMLElement): ComponentInfo {
  const hierarchy = buildComponentHierarchy(element);
  const dataFeed = inferDataFeed(element);
  const type = detectComponentType(element);

  return {
    type,
    hierarchy,
    dataFeed,
  };
}

function detectComponentType(element: HTMLElement): ComponentType {
  const tag = element.tagName.toLowerCase();
  const role = (element.getAttribute('role') || '').toLowerCase();
  const className = (typeof element.className === 'string' ? element.className : '').toLowerCase();
  const id = (element.getAttribute('id') || '').toLowerCase();

  // Layer 1: HTML5 Landmarks / Direct Tags
  if (tag === 'header') return 'header';
  if (tag === 'nav') return 'navbar';
  if (tag === 'footer') return 'footer';
  if (tag === 'dialog') return 'dialog';
  if (tag === 'aside') return 'sidebar';
  if (tag === 'table' || ['thead', 'tbody', 'tfoot', 'tr', 'th', 'td'].includes(tag)) return 'table';
  if (tag === 'form') return 'form';
  if (tag === 'iframe') return 'iframe';
  if (tag === 'img' || tag === 'svg') return 'image';

  // Layer 2: ARIA Roles
  if (role === 'dialog' || role === 'alertdialog' || role === 'alert') return 'modal';
  if (role === 'navigation') return 'navbar';
  if (role === 'banner') return 'header';
  if (role === 'contentinfo') return 'footer';
  if (role === 'complementary') return 'sidebar';
  if (role === 'tab' || role === 'tablist' || role === 'tabpanel') return 'tab';
  if (role === 'combobox' || role === 'listbox' || role === 'option') return 'dropdown';
  if (role === 'menu' || role === 'menubar' || role === 'menuitem') return 'menu';
  if (role === 'table' || role === 'grid') return 'table';
  if (role === 'form' || role === 'search') return 'form';
  if (role === 'tooltip') return 'tooltip';

  // Layer 3: Class / ID Heuristics for container-level components
  const classAndId = `${className} ${id}`;
  if (classAndId.match(/\b(modal|popup|overlay)\b/)) return 'modal';
  if (classAndId.match(/\b(dialog)\b/)) return 'dialog';
  if (classAndId.match(/\b(drawer|offcanvas|slideout)\b/)) return 'drawer';
  if (classAndId.match(/\b(navbar|nav-bar|navigation|topbar|app-bar)\b/)) return 'navbar';
  if (classAndId.match(/\b(page-header|site-header|header)\b/)) return 'header';
  if (classAndId.match(/\b(site-footer|footer)\b/)) return 'footer';
  if (classAndId.match(/\b(sidebar|side-nav|side-panel|sidenav)\b/)) return 'sidebar';
  if (classAndId.match(/\b(dropdown|select-menu|popover)\b/)) return 'dropdown';
  if (classAndId.match(/\b(accordion|collapsible|expandable)\b/)) return 'accordion';
  if (classAndId.match(/\b(breadcrumb)\b/)) return 'breadcrumb';
  if (classAndId.match(/\b(pagination|pager)\b/)) return 'pagination';
  if (classAndId.match(/\b(hero|jumbotron|billboard)\b/)) return 'hero';
  if (classAndId.match(/\b(tooltip)\b/)) return 'tooltip';
  if (classAndId.match(/\b(card|tile)\b/)) return 'card';
  if (classAndId.match(/\b(tab|tabs)\b/)) return 'tab';
  if (classAndId.match(/\b(datagrid|data-grid)\b/)) return 'table';

  // Specific interaction elements
  if (tag === 'button' || role === 'button') return 'button';
  if (tag === 'a' || role === 'link') return 'link';
  if (['input', 'textarea', 'select'].includes(tag)) return 'input';

  // Check parent landmark containers
  const parentLandmark = element.closest('header, nav, footer, aside, dialog, form, table, [role="dialog"], [role="navigation"]');
  if (parentLandmark) {
    const parentTag = parentLandmark.tagName.toLowerCase();
    const parentRole = (parentLandmark.getAttribute('role') || '').toLowerCase();
    if (parentRole === 'dialog') return 'modal';
    if (parentRole === 'navigation' || parentTag === 'nav') return 'navbar';
    if (parentTag === 'header') return 'header';
    if (parentTag === 'footer') return 'footer';
    if (parentTag === 'aside') return 'sidebar';
    if (parentTag === 'dialog') return 'dialog';
    if (parentTag === 'form') return 'form';
    if (parentTag === 'table') return 'table';
  }

  return 'generic';
}
