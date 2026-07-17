import { useState, useEffect } from "react";
import { Sparkles, LogIn, LogOut } from "lucide-react";
import { signIn, signOut, watchAuth } from "../../lib/db.firestore.js";
import { auth } from "../../lib/firebase.js";

export default function AccountCard({ sectionCls }) {
  const [user, setUser] = useState(() => auth.currentUser);

  useEffect(() => {
    return watchAuth(setUser);
  }, []);

  return (
    <section className={sectionCls}>
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="h-5 w-5 text-sky-300" />
        <h2 className="text-lg font-semibold">Account</h2>
      </div>
      {user ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
            {user.photoURL && <img src={user.photoURL} alt="" className="h-10 w-10 rounded-full" />}
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-100">{user.displayName}</div>
              <div className="truncate text-xs text-slate-500">{user.email}</div>
              <div className="mt-1 font-mono text-[9px] text-slate-600">UID: {user.uid}</div>
            </div>
            <span className="rounded-full bg-sky-500/20 px-3 py-1 text-[10px] uppercase tracking-widest text-sky-300">Cloud</span>
          </div>
          <button onClick={signOut} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/10">
            <LogOut className="h-4 w-4" />
            Abmelden
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">Melde dich an, um deine Daten in der Cloud (Firestore) zu speichern und geräteübergreifend zu synchronisieren.</p>
          <button onClick={signIn} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-400 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-300">
            <LogIn className="h-4 w-4" />
            Mit Google anmelden
          </button>
        </div>
      )}
    </section>
  );
}
