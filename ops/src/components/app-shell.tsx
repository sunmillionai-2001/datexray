"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAVIGATION = [
  { href: "/", label: "今日工作", eyebrow: "01" },
  { href: "/channels/x", label: "X 生成器", eyebrow: "02" },
  { href: "/library", label: "内容库", eyebrow: "03" },
  { href: "/ledger", label: "内容台账", eyebrow: "04" },
  { href: "/review", label: "数据复盘", eyebrow: "05" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  function navigationLinks(compact = false) {
    return NAVIGATION.map((item) => {
      const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
      return (
        <Link key={item.href} href={item.href} className={active ? "active" : undefined}>
          {compact ? null : <small>{item.eyebrow}</small>}
          <span>{item.label}</span>
          {compact ? null : <b aria-hidden="true">↗</b>}
        </Link>
      );
    });
  }

  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <aside className="sidebar">
        <Link href="/" className="brand-lockup" aria-label="DateXray 运营工作台首页">
          <span className="brand-mark" aria-hidden="true">DX</span>
          <span><strong>DATEXRAY</strong><small>运营工作台</small></span>
        </Link>
        <p className="sidebar-folio">运营编辑部 · 本地版</p>

        <nav aria-label="主导航" className="primary-nav">
          {navigationLinks()}
        </nav>

        <div className="channel-rail">
          <p>渠道</p>
          <Link href="/channels/x"><span className="channel-dot x" />X <b>可用</b></Link>
          <Link href="/channels/tiktok"><span className="channel-dot" />TikTok <b>预留</b></Link>
          <Link href="/channels/reddit"><span className="channel-dot" />Reddit <b>预留</b></Link>
        </div>

        <div className="local-badge"><span />仅限本地 · :3100</div>
      </aside>
      <div className="workspace" id="main-content">
        <header className="mobile-header">
          <div className="mobile-header-top">
            <Link href="/" className="brand-lockup"><span className="brand-mark" aria-hidden="true">DX</span><strong>运营工作台</strong></Link>
            <Link href="/channels/x" className="mobile-action">新建推文</Link>
          </div>
          <nav className="mobile-nav" aria-label="移动端主导航">{navigationLinks(true)}</nav>
        </header>
        {children}
      </div>
    </div>
  );
}
