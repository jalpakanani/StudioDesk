import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {useTranslation} from 'react-i18next'
import {useStudio} from '../context/StudioContext'
import {useTab} from '../context/TabContext'
import {buildDeskSearchResults} from '../utils/deskSearch'

export default function GlobalSearch() {
  const {t} = useTranslation()
  const {clients, orders, fieldVisits, clientById} = useStudio()
  const {setTab, setNavFocus} = useTab()
  const [query, setQuery] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)
  const rootRef = useRef(null)
  const inputRef = useRef(null)

  const results = useMemo(
    () =>
      buildDeskSearchResults(query, {clients, orders, fieldVisits, clientById}, {
        client: t('search.fallbackClient'),
        order: t('search.fallbackOrder'),
        visitVenue: t('search.fallbackVisit'),
        visitTitle: t('search.fallbackVisitTitle'),
        emDash: t('common.dash'),
      }),
    [query, clients, orders, fieldVisits, clientById, t],
  )

  const grouped = useMemo(() => {
    const g = {client: [], order: [], visit: []}
    for (const r of results) {
      g[r.kind].push(r)
    }
    return g
  }, [results])

  const closePanel = useCallback(() => {
    setPanelOpen(false)
    inputRef.current?.blur()
  }, [])

  useEffect(() => {
    if (!panelOpen) return undefined
    function onDocMouseDown(e) {
      if (rootRef.current?.contains(e.target)) return
      closePanel()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [panelOpen, closePanel])

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setPanelOpen(true)
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        e.preventDefault()
        setQuery('')
        closePanel()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closePanel])

  function go(item) {
    setNavFocus({kind: item.kind, id: item.id})
    setTab(item.tab)
    setQuery('')
    closePanel()
  }

  const isMac =
    typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform)
  const hasQuery = Boolean(query.trim())
  const showShortcut = !hasQuery

  return (
    <div
      ref={rootRef}
      className={`global-search-inline${panelOpen ? ' global-search-inline--open' : ''}`}
    >
      <div className="global-search-field-bar">
        <span className="global-search-field-icon" aria-hidden="true">
          <svg
            className="global-search-field-svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            focusable="false"
          >
            <circle cx="10.5" cy="10.5" r="5.75" />
            <path d="M15.5 15.5L21 21" />
          </svg>
        </span>
        <input
          ref={inputRef}
          id="desk-global-search"
          type="search"
          autoComplete="off"
          spellCheck={false}
          placeholder={t('search.placeholder')}
          aria-label={t('search.ariaField')}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setPanelOpen(true)}
        />
        {showShortcut ? (
          <kbd
            className="global-search-kbd global-search-field-shortcut"
            aria-hidden="true"
          >
            {isMac ? '⌘' : 'Ctrl'}K
          </kbd>
        ) : null}
      </div>

      {panelOpen ? (
        <div
          id="desk-search-results"
          className="global-search-panel"
          role="region"
          aria-label={t('search.results')}
        >
          {!hasQuery ? (
            <p className="global-search-panel-hint muted small">
              {t('search.hint')}{' '}
              <kbd className="global-search-kbd global-search-kbd--inline">
                {isMac ? '⌘' : 'Ctrl'}K
              </kbd>{' '}
              {t('search.focusesField')}
            </p>
          ) : results.length === 0 ? (
            <p className="global-search-empty muted small">{t('search.noMatches')}</p>
          ) : (
            <div className="global-search-groups">
              {grouped.client.length > 0 ? (
                <section className="global-search-group" aria-label={t('search.groupClients')}>
                  <h4 className="global-search-group-title">{t('search.groupClients')}</h4>
                  <ul className="global-search-list">
                    {grouped.client.map(r => (
                      <li key={`c-${r.id}`}>
                        <button
                          type="button"
                          className="global-search-row"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => go(r)}
                        >
                          <span className="global-search-row-title">
                            {r.title}
                          </span>
                          <span className="global-search-row-sub muted small">
                            {r.subtitle}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {grouped.order.length > 0 ? (
                <section className="global-search-group" aria-label={t('search.groupOrders')}>
                  <h4 className="global-search-group-title">{t('search.groupOrders')}</h4>
                  <ul className="global-search-list">
                    {grouped.order.map(r => (
                      <li key={`o-${r.id}`}>
                        <button
                          type="button"
                          className="global-search-row"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => go(r)}
                        >
                          <span className="global-search-row-title">
                            {r.title}
                          </span>
                          <span className="global-search-row-sub muted small">
                            {r.subtitle}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
              {grouped.visit.length > 0 ? (
                <section
                  className="global-search-group"
                  aria-label={t('search.groupVisits')}
                >
                  <h4 className="global-search-group-title">{t('search.groupVisits')}</h4>
                  <ul className="global-search-list">
                    {grouped.visit.map(r => (
                      <li key={`v-${r.id}`}>
                        <button
                          type="button"
                          className="global-search-row"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => go(r)}
                        >
                          <span className="global-search-row-title">
                            {r.title}
                          </span>
                          <span className="global-search-row-sub muted small">
                            {r.subtitle}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
