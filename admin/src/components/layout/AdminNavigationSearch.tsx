import { useEffect, useId, useState } from "react";
import { ArrowUpRight, Search, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { tr } from "@/i18n";

type Group = { label: string; items: { to: string; label: string; icon: LucideIcon }[] };

/** 搜索管理功能；只导航，不读取或修改业务数据。 */
export function AdminNavigationSearch({ open, onOpenChange, groups }: {
  open: boolean; onOpenChange: (value: boolean) => void; groups: Group[];
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const items = groups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label })))
    .filter((item) => `${item.label}${item.group}${item.to}`.toLowerCase().includes(query.trim().toLowerCase()));
  useEffect(() => { if (open) { setQuery(""); setActive(0); } }, [open]);
  function go(to: string) { onOpenChange(false); navigate(to); }
  useEffect(() => { document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: "nearest" }); }, [active, listId]);
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="admin-navigation-dialog">
      <DialogTitle className="sr-only">{tr("ui.navSearchTitle")}</DialogTitle>
      <DialogDescription className="sr-only">{tr("ui.navSearchDesc")}</DialogDescription>
      <div className="admin-navigation-search"><Search size={20} /><input
        autoFocus placeholder={tr("ui.navSearchPlaceholder")} value={query}
        role="combobox" aria-label={tr("ui.navSearchTitle")} aria-expanded={open} aria-controls={listId}
        aria-activedescendant={items.length ? `${listId}-${active}` : undefined} aria-autocomplete="list"
        onChange={(event) => { setQuery(event.target.value); setActive(0); }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault(); setActive((value) => items.length ? (value + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length : 0);
          }
          if (event.key === "Enter" && items[active]) { event.preventDefault(); go(items[active].to); }
        }} /></div>
      <div className="admin-navigation-results" role="listbox" id={listId} aria-label={tr("ui.navSearchResults")}>
        {items.map((item, index) => <button type="button" role="option" aria-selected={index === active}
          className={index === active ? "is-selected" : ""} id={`${listId}-${index}`} key={item.to}
          onMouseMove={() => setActive(index)} onClick={() => go(item.to)}>
          <span className="admin-navigation-result-icon"><item.icon size={18} /></span>
          <span><strong>{item.label}</strong><small>{item.group}</small></span><ArrowUpRight size={16} />
        </button>)}
        {!items.length && <p className="admin-navigation-empty">{tr("ui.navSearchEmpty")}</p>}
      </div>
      <div className="admin-navigation-footer"><span><kbd>↑</kbd><kbd>↓</kbd> {tr("ui.navSwitch")}</span><span><kbd>Enter</kbd> {tr("ui.navEnter")}</span><span><kbd>Esc</kbd> {tr("ui.navClose")}</span></div>
    </DialogContent>
  </Dialog>;
}
