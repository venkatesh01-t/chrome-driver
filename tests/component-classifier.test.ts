import { describe, it, expect, beforeEach } from 'vitest';
import {
  classifyComponent,
  buildComponentHierarchy,
  inferDataFeed,
} from '../src/content/component-classifier';

describe('Component Classifier', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('HTML5 Semantic Landmarks', () => {
    it('classifies <header> as header', () => {
      document.body.innerHTML = '<header><div id="target">Logo</div></header>';
      const el = document.querySelector('header') as HTMLElement;
      expect(classifyComponent(el).type).toBe('header');
    });

    it('classifies <nav> as navbar', () => {
      document.body.innerHTML = '<nav id="main-nav"><a href="/">Home</a></nav>';
      const el = document.getElementById('main-nav') as HTMLElement;
      expect(classifyComponent(el).type).toBe('navbar');
    });

    it('classifies <footer> as footer', () => {
      document.body.innerHTML = '<footer><p>&copy; 2026</p></footer>';
      const el = document.querySelector('footer') as HTMLElement;
      expect(classifyComponent(el).type).toBe('footer');
    });

    it('classifies <dialog> as dialog', () => {
      document.body.innerHTML = '<dialog id="dlg">Dialog content</dialog>';
      const el = document.getElementById('dlg') as HTMLElement;
      expect(classifyComponent(el).type).toBe('dialog');
    });

    it('classifies <aside> as sidebar', () => {
      document.body.innerHTML = '<aside id="side">Sidebar content</aside>';
      const el = document.getElementById('side') as HTMLElement;
      expect(classifyComponent(el).type).toBe('sidebar');
    });

    it('classifies <table>, <tr>, and <td> as table', () => {
      document.body.innerHTML = '<table id="data"><tr><td id="cell">Value</td></tr></table>';
      const table = document.getElementById('data') as HTMLElement;
      const cell = document.getElementById('cell') as HTMLElement;
      expect(classifyComponent(table).type).toBe('table');
      expect(classifyComponent(cell).type).toBe('table');
    });

    it('classifies <form> as form', () => {
      document.body.innerHTML = '<form id="login-form"><button>Submit</button></form>';
      const el = document.getElementById('login-form') as HTMLElement;
      expect(classifyComponent(el).type).toBe('form');
    });

    it('classifies <iframe> as iframe', () => {
      document.body.innerHTML = '<iframe id="embed" src="about:blank"></iframe>';
      const el = document.getElementById('embed') as HTMLElement;
      expect(classifyComponent(el).type).toBe('iframe');
    });
  });

  describe('ARIA Roles', () => {
    it('classifies role="dialog" and role="alertdialog" as modal', () => {
      document.body.innerHTML = `
        <div id="modal1" role="dialog">Modal 1</div>
        <div id="modal2" role="alertdialog">Modal 2</div>
      `;
      const m1 = document.getElementById('modal1') as HTMLElement;
      const m2 = document.getElementById('modal2') as HTMLElement;
      expect(classifyComponent(m1).type).toBe('modal');
      expect(classifyComponent(m2).type).toBe('modal');
    });

    it('classifies role="navigation" as navbar', () => {
      document.body.innerHTML = '<div id="nav" role="navigation"><a href="/">Link</a></div>';
      const el = document.getElementById('nav') as HTMLElement;
      expect(classifyComponent(el).type).toBe('navbar');
    });

    it('classifies role="tab" and role="tablist" as tab', () => {
      document.body.innerHTML = '<div role="tablist"><button id="tab1" role="tab">Tab 1</button></div>';
      const el = document.getElementById('tab1') as HTMLElement;
      expect(classifyComponent(el).type).toBe('tab');
    });

    it('classifies role="menu" as menu', () => {
      document.body.innerHTML = '<ul id="menu" role="menu"><li role="menuitem">Item</li></ul>';
      const el = document.getElementById('menu') as HTMLElement;
      expect(classifyComponent(el).type).toBe('menu');
    });
  });

  describe('CSS Heuristics & Classes', () => {
    it('classifies element with modal/popup class as modal', () => {
      document.body.innerHTML = '<div class="app-modal-wrapper" id="mod">Content</div>';
      const el = document.getElementById('mod') as HTMLElement;
      expect(classifyComponent(el).type).toBe('modal');
    });

    it('classifies element with drawer class as drawer', () => {
      document.body.innerHTML = '<div class="side-drawer" id="drw">Drawer</div>';
      const el = document.getElementById('drw') as HTMLElement;
      expect(classifyComponent(el).type).toBe('drawer');
    });

    it('classifies element with accordion class as accordion', () => {
      document.body.innerHTML = '<div class="accordion-item" id="acc">Section</div>';
      const el = document.getElementById('acc') as HTMLElement;
      expect(classifyComponent(el).type).toBe('accordion');
    });

    it('classifies element with pagination class as pagination', () => {
      document.body.innerHTML = '<div class="pagination-container" id="pag">Pages</div>';
      const el = document.getElementById('pag') as HTMLElement;
      expect(classifyComponent(el).type).toBe('pagination');
    });
  });

  describe('Direct Action Elements', () => {
    it('classifies button as button', () => {
      document.body.innerHTML = '<button id="btn">Click</button>';
      const el = document.getElementById('btn') as HTMLElement;
      expect(classifyComponent(el).type).toBe('button');
    });

    it('classifies anchor as link', () => {
      document.body.innerHTML = '<a id="lnk" href="/about">About</a>';
      const el = document.getElementById('lnk') as HTMLElement;
      expect(classifyComponent(el).type).toBe('link');
    });

    it('classifies input as input', () => {
      document.body.innerHTML = '<input id="txt" type="text" />';
      const el = document.getElementById('txt') as HTMLElement;
      expect(classifyComponent(el).type).toBe('input');
    });

    it('falls back to generic for plain div', () => {
      document.body.innerHTML = '<div id="plain">Plain content</div>';
      const el = document.getElementById('plain') as HTMLElement;
      expect(classifyComponent(el).type).toBe('generic');
    });
  });

  describe('Component Hierarchy Builder', () => {
    it('builds ancestor chain string', () => {
      document.body.innerHTML = `
        <header id="site-header">
          <nav>
            <ul class="nav-list">
              <li>
                <a id="home-link" href="/">Home</a>
              </li>
            </ul>
          </nav>
        </header>
      `;
      const link = document.getElementById('home-link') as HTMLElement;
      const hierarchy = buildComponentHierarchy(link);
      expect(hierarchy).toContain('header');
      expect(hierarchy).toContain('nav');
      expect(hierarchy).toContain('a#home-link');
    });
  });

  describe('Data Feed Inference', () => {
    it('infers search_query for search input or placeholder', () => {
      document.body.innerHTML = `
        <input id="s1" type="search" />
        <input id="s2" type="text" placeholder="Search products..." />
      `;
      expect(inferDataFeed(document.getElementById('s1') as HTMLElement)).toBe('search_query');
      expect(inferDataFeed(document.getElementById('s2') as HTMLElement)).toBe('search_query');
    });

    it('infers credentials for password or auth inputs', () => {
      document.body.innerHTML = `
        <input id="p1" type="password" />
        <input id="auth_key" type="text" name="user_password" />
      `;
      expect(inferDataFeed(document.getElementById('p1') as HTMLElement)).toBe('credentials');
      expect(inferDataFeed(document.getElementById('auth_key') as HTMLElement)).toBe('credentials');
    });

    it('infers file_upload for type="file"', () => {
      document.body.innerHTML = '<input id="upload" type="file" />';
      expect(inferDataFeed(document.getElementById('upload') as HTMLElement)).toBe('file_upload');
    });

    it('infers boolean_flag for checkbox and radio', () => {
      document.body.innerHTML = `
        <input id="chk" type="checkbox" />
        <input id="rad" type="radio" />
      `;
      expect(inferDataFeed(document.getElementById('chk') as HTMLElement)).toBe('boolean_flag');
      expect(inferDataFeed(document.getElementById('rad') as HTMLElement)).toBe('boolean_flag');
    });

    it('infers selection_value for select element', () => {
      document.body.innerHTML = '<select id="opts"><option>A</option></select>';
      expect(inferDataFeed(document.getElementById('opts') as HTMLElement)).toBe('selection_value');
    });
  });
});
