import React from "react";
import AccountCard from "./AccountCard.jsx";
import GoalsCard from "./GoalsCard.jsx";
import ProfileCard from "./ProfileCard.jsx";
import VersionCard from "./VersionCard.jsx";
import SystemHealthCard from "./SystemHealthCard.jsx";
import PushRemindersCard from "./PushRemindersCard.jsx";

const sectionCls = "rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur grid gap-4";
const labelCls = "text-xs uppercase tracking-[0.18em] text-slate-500 mb-1 block";
const inputCls = "w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-slate-100";

export default function SettingsView() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <AccountCard sectionCls={sectionCls} />
      <GoalsCard sectionCls={sectionCls} labelCls={labelCls} inputCls={inputCls} />
      <ProfileCard sectionCls={sectionCls} labelCls={labelCls} inputCls={inputCls} />
      <PushRemindersCard sectionCls={sectionCls} labelCls={labelCls} inputCls={inputCls} />
      <VersionCard sectionCls={sectionCls} />
      <SystemHealthCard sectionCls={sectionCls} />
    </div>
  );
}
