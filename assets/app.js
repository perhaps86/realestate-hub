/* realestate-hub 셸 — data/*.js 가 정의한 window.HUB_DATA 를 렌더링 (fetch 없음) */
(function () {
  "use strict";
  const D = window.HUB_DATA || {};
  const $ = (s) => document.querySelector(s);

  const won = (v) => {
    if (v == null) return "-";
    const sign = v < 0 ? "-" : "", a = Math.abs(v);
    if (a >= 100000000) {
      const eok = a / 100000000;
      return sign + (eok >= 10 ? Math.round(eok).toLocaleString() : (Math.round(eok * 10) / 10)) + "억";
    }
    return sign + Math.round(a / 10000).toLocaleString() + "만";
  };
  const pct = (v) => (v == null ? "-" : Math.round(v * 100) + "%");
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function setMeta(count) {
    const m = D.meta || {};
    const el = $("#meta");
    if (el) el.textContent = `총 ${count}건 · 마지막 업데이트 ${m.generated_at || "-"} KST`;
  }

  /* ---------------- 진행중 (listings) ---------------- */
  const LF = { region: "전체", cat: "전체", disc15: false, exact: false, fail2: false, soon: false, q: "" };

  function listingVisible(it) {
    if (LF.region !== "전체" && it.sido !== LF.region) return false;
    if (LF.cat !== "전체" && it.category !== LF.cat) return false;
    if (LF.disc15 && !(it.discount_market >= 0.15)) return false;
    if (LF.exact && it.match_quality !== "exact") return false;
    if (LF.fail2 && !((it.fail_count || 0) >= 2)) return false;
    if (LF.soon) {
      if (!it.bid_close_at) return false;
      const left = new Date(it.bid_close_at).getTime() - Date.now();
      if (left < 0 || left > 86400000) return false;
    }
    if (LF.q && !`${it.name || ""} ${it.address || ""}`.toLowerCase().includes(LF.q)) return false;
    return true;
  }

  const closeLabel = (iso) => (iso ? iso.slice(0, 16).replace("T", " ") + " 마감" : "마감 미상");

  function listingItem(it) {
    const tags = [];
    if (it.category) tags.push(`<span class="tag blue">${esc(it.category)}</span>`);
    if (it.match_quality === "approx") tags.push(`<span class="tag warn">⚠시세 approx(동 단위)</span>`);
    if (it.deep_discount)
      tags.push(`<span class="tag warn">⚠극단저감(최저가&lt;감정가 30%) — 권리분석 필수</span>`);
    if ((it.fail_count || 0) >= 1)
      tags.push(`<span class="tag${it.fail_count >= 2 ? " warn" : ""}">유찰 ${it.fail_count}회</span>`);
    const title = it.low_sample
      ? esc(it.name)
      : `${esc(it.name)} · 할인 ${pct(it.discount_market)}`;
    const line = it.low_sample
      ? `최저 ${won(it.min_bid_price)} · 감정가 ${won(it.appraisal_price)} · 메리트 ${pct(it.merit)}`
      : `최저 ${won(it.min_bid_price)} · 시세 ${won(it.expected_sale_price)} · 수익률 ${pct(it.expected_yield)} · 감정가 ${won(it.appraisal_price)}`;
    const costRows = Object.entries(it.cost_items || {})
      .map(([k, v]) => `<tr><td>${esc(k)}</td><td>${Number(v).toLocaleString()}원</td></tr>`).join("");
    const disc = it.discount_market;
    const costBox = `<div class="costbox">
      <table><tbody>
        <tr><td>최저입찰가</td><td>${(it.min_bid_price ?? 0).toLocaleString()}원</td></tr>
        ${costRows}
        <tr class="sum"><td>부대비용 합계</td><td>${(it.cost_total ?? 0).toLocaleString()}원</td></tr>
        <tr class="sum"><td>총투자금</td><td>${(it.total_cost ?? 0).toLocaleString()}원</td></tr>
        ${it.expected_sale_price ? `<tr><td>매도예상가(시세)</td><td>${it.expected_sale_price.toLocaleString()}원</td></tr>
        <tr class="sum"><td>차익(시세-총투자금)</td><td>${(it.expected_sale_price - (it.total_cost ?? 0)).toLocaleString()}원${disc != null ? ` (${Math.round(disc * 100)}%)` : ""}</td></tr>` : ""}
      </tbody></table>
      <p class="note">※ 양도세 제외 세전 기준 — 보유기간별 세후 수치는 엑셀 입찰가산정 시트에서</p>
    </div>`;
    return `<li><span class="date">${esc(closeLabel(it.bid_close_at))}</span>
      <h3>${title}</h3><p class="line">${line}</p>
      <div class="tags">${tags.join("")}</div>
      <p class="src">${esc(it.address || "")}
        <a href="${esc(it.detail_url)}" target="_blank" rel="noopener">온비드 상세</a>${
        it.market_url ? ` <a href="${esc(it.market_url)}" target="_blank" rel="noopener">시세 검색</a>` : ""}
        <a class="costlink">비용내역</a>
        <a class="rightslink" data-cltr="${esc(it.cltr_no)}">권리분석</a></p>${costBox}</li>`;
  }

  function renderListings() {
    const all = (D.listings && D.listings.items) || [];
    const vis = all.filter((i) => !i.low_sample).filter(listingVisible);
    const low = all.filter((i) => i.low_sample).filter(listingVisible);
    $("#list").innerHTML = vis.map(listingItem).join("") ||
      `<li class="empty">조건에 맞는 물건이 없습니다</li>`;
    $("#count").textContent = `${vis.length}건`;
    const wrap = $("#low-wrap");
    wrap.style.display = low.length ? "" : "none";
    $("#low-sum").textContent = `시세 미산출 ${low.length}건 — 실거래 표본 부족(메리트 순)`;
    $("#low-list").innerHTML = low.map(listingItem).join("");
  }

  function initListings() {
    setMeta(((D.listings && D.listings.items) || []).length);
    document.querySelectorAll(".chip").forEach((c) => {
      c.addEventListener("click", () => {
        const k = c.dataset.k, v = c.dataset.v;
        if (v !== undefined) {
          LF[k] = v;
          document.querySelectorAll(`.chip[data-k="${k}"]`)
            .forEach((x) => x.classList.toggle("on", x === c));
        } else {
          LF[k] = !LF[k];
          c.classList.toggle("on", LF[k]);
        }
        renderListings();
      });
    });
    $("#q").addEventListener("input", (e) => {
      LF.q = e.target.value.trim().toLowerCase();
      renderListings();
    });
    renderListings();
  }

  /* ---------------- 결과 (results) ---------------- */
  let RFILTER = "전체";

  function resultItem(r) {
    const wonBid = r.outcome === "낙찰";
    let line;
    if (wonBid) {
      const diff = r.expected_sale_price && r.winning_price != null
        ? r.expected_sale_price - r.winning_price : null;
      line = `낙찰 ${won(r.winning_price)}` +
        (r.expected_sale_price ? ` · 시세 ${won(r.expected_sale_price)}` : "") +
        (diff != null ? ` · 차액 ${diff >= 0 ? "+" : "-"}${won(diff)}` : "");
    } else {
      line = `최저 ${won(r.min_bid_price)} · 감정가 ${won(r.appraisal_price)}` +
        (r.expected_sale_price ? ` · 시세 ${won(r.expected_sale_price)}` : "");
    }
    const tagCls = wonBid ? "blue" : (r.outcome === "유찰" ? "warn" : "");
    return `<li><span class="date">${esc(r.date || "")}</span>
      <h3><span class="tag ${tagCls}">${esc(r.outcome)}</span> ${esc(r.name)}</h3>
      <p class="line">${line}</p>
      <p class="src">${esc(r.sido || "")}<a href="${esc(r.detail_url)}" target="_blank" rel="noopener">온비드 상세</a></p></li>`;
  }

  function renderResults() {
    const all = (D.results && D.results.items) || [];
    const vis = all.filter((r) =>
      RFILTER === "전체" ? true : r.outcome === RFILTER);
    $("#list").innerHTML = vis.map(resultItem).join("") ||
      `<li class="empty">아직 수집된 결과가 없습니다 — 정기 실행이 쌓아갑니다</li>`;
    $("#count").textContent = `${vis.length}건`;
  }

  function initResults() {
    setMeta(((D.results && D.results.items) || []).length);
    document.querySelectorAll(".chip[data-k='rf']").forEach((c) => {
      c.addEventListener("click", () => {
        RFILTER = c.dataset.v;
        document.querySelectorAll(".chip[data-k='rf']")
          .forEach((x) => x.classList.toggle("on", x === c));
        renderResults();
      });
    });
    renderResults();
  }

  /* ---------------- 통계 (stats) ---------------- */
  function bars(el, rows) {
    const maxv = Math.max(1, ...rows.map((r) => Math.max(r.won, r.passed)));
    el.innerHTML = rows.map((r) => `<div class="bar-row"><span class="bl">${esc(r.label)}</span>
      <div class="bar-track">
        <div class="bar" style="width:${(r.won / maxv) * 55}%"></div>
        <div class="bar gray" style="width:${(r.passed / maxv) * 55}%"></div>
      </div><span class="bv">${r.won} / ${r.passed}</span></div>`).join("");
  }

  function initStats() {
    const s = D.stats || {};
    setMeta(s.sample || 0);
    if (s.insufficient) {
      $("#banner").style.display = "";
      $("#banner").textContent = `표본 축적 중 (${s.sample || 0}건 / 30건) — 수치는 참고만`;
    }
    $("#c-won").textContent = s.won ?? 0;
    $("#c-passed").textContent = s.passed ?? 0;
    $("#c-ratio").textContent = s.ratio_median != null ? (s.ratio_median * 100).toFixed(1) + "%" : "-";
    $("#c-sample").textContent = s.sample ?? 0;
    bars($("#m-bars"), s.monthly || []);
    bars($("#b-bars"), s.bands || []);
  }

  /* ---------------- 기준표 (costs) ---------------- */
  function table(el, head, rows) {
    el.innerHTML = `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((c) =>
        `<td>${typeof c === "number" ? c.toLocaleString() : esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }

  function initCosts() {
    const c = D.costs || {};
    setMeta(4);
    table($("#t-base"), ["항목", "값"], [
      ["취득세율", c.acquisition_tax_rate != null ? (c.acquisition_tax_rate * 100).toFixed(1) + "%" : "-"],
      ["명도비", c.eviction_cost ?? "-"],
      ["청소비", c.cleaning_cost ?? "-"],
      ["기타잡비", c.misc_cost ?? "-"],
    ]);
    const g = c.cgt_rates || {};
    table($("#t-cgt"), ["보유기간", "세율"], [
      ["1년 미만", g.under_1y != null ? Math.round(g.under_1y * 100) + "%" : "-"],
      ["1~2년", g["1y_to_2y"] != null ? Math.round(g["1y_to_2y"] * 100) + "%" : "-"],
      ["2년 이상", g.over_2y != null ? Math.round(g.over_2y * 100) + "%" : "-"],
    ]);
  }

  /* ---------------- 지역 (regions) ---------------- */
  const R_LABELS = {
    sale_index: "가격(저평가)", jeonse_ratio: "전세가율",
    new_supply: "공급여유", unsold: "미분양적음",
  };
  const R_ORDER = ["sale_index", "jeonse_ratio", "new_supply", "unsold"];

  const rClamp = (v) => Math.max(0, Math.min(100, Number(v) || 0));
  const rLevel = (v) => (v >= 66 ? "상위" : v <= 33 ? "하위" : "중간");

  function ctxBar(k, v) {
    return `<div class="rbar ctx"><span class="rbl">${esc(R_LABELS[k] || k)}</span>
      <span class="rbar-track"><span class="rbar-fill" style="width:${rClamp(v)}%"></span></span>
      <span class="rbv">${Math.round(rClamp(v))}</span></div>`;
  }

  function regionRow(it, weights) {
    const comps = it.components || {};
    const scored = R_ORDER.filter((k) => (weights[k] || 0) > 0);
    const context = R_ORDER.filter((k) => k in comps && !((weights[k] || 0) > 0));

    const scoredHtml = scored.map((k) => {
      const v = rClamp(comps[k]);
      return `<div class="rbar scored"><span class="rbl">${esc(R_LABELS[k] || k)} <b>${Math.round(weights[k] * 100)}%</b></span>
        <span class="rbar-track"><span class="rbar-fill" style="width:${v}%"></span></span>
        <span class="rbv">${Math.round(v)}</span></div>`;
    }).join("");

    const contrib = scored.map((k) => {
      const v = rClamp(comps[k]);
      return `${R_LABELS[k] || k} ${Math.round(v)}×${Math.round(weights[k] * 100)}% = ${(v * weights[k]).toFixed(1)}`;
    }).join(" + ") + ` = ${(it.total_score ?? 0).toFixed(1)}점`;

    const interp = scored.map((k) => `${R_LABELS[k] || k} ${rLevel(rClamp(comps[k]))}`).join(" · ");

    const ctxHtml = context.length
      ? `<div class="rctx-label">참고 지표 (점수 미반영)</div>${context.map((k) => ctxBar(k, comps[k])).join("")}`
      : "";

    return `<div class="rcard">
      <div class="rhead"><span class="rrank">${esc(it.rank)}</span>
        <span class="rsido">${esc(it.sido)}</span>
        <span class="rscore">${(it.total_score ?? 0).toFixed(1)}점</span></div>
      <div class="rsub">점수 구성</div>
      <div class="rscored">${scoredHtml}</div>
      <a class="rdetail-link">▾ 자세히 (왜 이 점수? · 참고 지표)</a>
      <div class="rdetail">
        <p class="rcontrib">${esc(contrib)}</p>
        <p class="rinterp">${esc(interp)}</p>
        ${ctxHtml}
      </div></div>`;
  }

  function initRegions() {
    const r = D.regions || {};
    const items = r.items || [];
    setMeta(items.length);
    const w = r.weights || {};
    const wtxt = R_ORDER.filter((k) => (w[k] || 0) > 0)
      .map((k) => `${R_LABELS[k]} ${Math.round((w[k]) * 100)}%`).join(" + ");
    $("#basis").textContent = r.ym
      ? `기준월 ${r.ym.slice(0, 4)}.${r.ym.slice(4, 6)} · 점수 = ${wtxt || "균등"} · ${r.sample ?? "?"}개 시도`
      : "아직 채점된 데이터가 없습니다 — 정기 실행이 매월 갱신합니다";
    $("#regions").innerHTML = items.map((it) => regionRow(it, w)).join("") ||
      `<div class="empty">데이터 없음</div>`;
    renderHistory(r.history);
    renderRentOwn(D.rent_own || {});
    $("#r-legend").textContent = "※ 각 막대는 17개 시도 내 0~100 정규화(높을수록 유리). 종합점수 = 반영 지표 × 가중치 합.";
  }

  function rankColor(rank, n) {
    const L = 55 + ((rank - 1) / Math.max(1, n - 1)) * 41;
    return `background:hsl(217,85%,${L}%);color:${L < 70 ? "#fff" : "#1e293b"}`;
  }

  function renderHistory(h) {
    const el = $("#r-history");
    if (!el) return;
    const months = (h && h.months) || [];
    const rows = (h && h.rows) || [];
    if (!months.length || !rows.length) { el.innerHTML = ""; return; }
    const n = rows.length;
    const head = `<th>시도</th>` +
      months.map((m) => `<th>${esc(m.slice(2, 4))}.${esc(m.slice(4, 6))}</th>`).join("") +
      `<th>변동</th>`;
    const body = rows.map((r) => {
      const cells = r.ranks.map((rk) => rk == null
        ? `<td class="rh-na">·</td>`
        : `<td style="${rankColor(rk, n)}">${rk}</td>`).join("");
      const last = r.ranks[r.ranks.length - 1];
      const prev = r.ranks[r.ranks.length - 2];
      let chg = "";
      if (last != null && prev != null) {
        const d = prev - last;  // 양수 = 순위 상승
        chg = d > 0 ? `<span class="up">▲${d}</span>` : d < 0 ? `<span class="dn">▼${-d}</span>` : "–";
      }
      return `<tr><td class="rh-sido">${esc(r.sido)}</td>${cells}<td>${chg}</td></tr>`;
    }).join("");
    el.innerHTML = `<div class="rh-scroll"><table class="rh-table">
      <thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  // 색상은 Python이 config의 neutral_band로 정한 verdict를 그대로 따른다(임계값 변경 시 자동 일치).
  function roClass(verdict) {
    return verdict === "집주인 유리" ? "ro-own"
      : verdict === "세입자 유리" ? "ro-tenant" : "ro-neutral";
  }

  function renderRentOwn(ro) {
    const el = $("#rent-own");
    if (!el) return;
    const items = ro.items || [];
    const basis = $("#ro-basis");
    if (basis) basis.textContent = ro.ym
      ? `기준월 ${ro.ym.slice(0, 4)}.${ro.ym.slice(4, 6)} · 주담대금리 ${ro.mortgage_rate}% · 수익률−금리 = 스프레드(%p)`
      : "아직 데이터가 없습니다";
    if (!items.length) { el.innerHTML = `<div class="empty">데이터 없음</div>`; return; }
    const max = Math.max(1, ...items.map((it) => Math.abs(it.spread)));
    el.innerHTML = items.map((it) => {
      const w = (Math.abs(it.spread) / max) * 50;  // 0~50% 폭, 0=중앙
      const side = it.spread >= 0 ? "left:50%" : `right:50%`;
      return `<div class="ro-row ${roClass(it.verdict)}">
        <span class="ro-sido">${esc(it.sido)}</span>
        <span class="ro-bar"><i style="${side};width:${w}%"></i></span>
        <span class="ro-val">${it.spread > 0 ? "+" : ""}${it.spread.toFixed(2)}%p</span>
        <span class="ro-verdict">${esc(it.verdict)}</span>
      </div>`;
    }).join("");
    const leg = $("#ro-legend");
    if (leg) leg.textContent = "※ 막대 오른쪽(+)=집주인 유리, 왼쪽(−)=세입자 유리. ±0.5%p 이내는 중립.";
  }

  /* ---------------- 도움말 툴팁 (모바일 탭 토글) ---------------- */
  document.addEventListener("click", (e) => {
    const h = e.target.closest(".help");
    document.querySelectorAll(".help.open").forEach((x) => { if (x !== h) x.classList.remove("open"); });
    if (h) h.classList.toggle("open");
  });

  /* ---------------- 비용내역 펼침 ---------------- */
  document.addEventListener("click", (e) => {
    const l = e.target.closest(".costlink");
    if (!l) return;
    const box = l.closest("li") && l.closest("li").querySelector(".costbox");
    if (box) box.classList.toggle("open");
  });

  /* ---------------- 지역 자세히 펼침 ---------------- */
  document.addEventListener("click", (e) => {
    const l = e.target.closest(".rdetail-link");
    if (!l) return;
    const box = l.parentElement && l.parentElement.querySelector(".rdetail");
    if (box) box.classList.toggle("open");
  });

  /* ---------------- 지역 순위변화 펼침 ---------------- */
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#rhist-toggle")) return;
    const el = $("#r-history");
    if (el) el.classList.toggle("open");
  });

  /* ---------------- 권리분석 패키지 (로컬 헬퍼 호출) ---------------- */
  // 포트는 config.yaml의 rights.server_port 기본값(8917)과 일치해야 한다.
  const RIGHTS_HELPER = "http://127.0.0.1:8917";

  document.addEventListener("click", async (e) => {
    const l = e.target.closest(".rightslink");
    if (!l) return;
    const cltr = l.dataset.cltr;
    const orig = l.textContent;
    l.textContent = "생성 중...";
    try {
      const res = await fetch(`${RIGHTS_HELPER}/rights?cltr=${encodeURIComponent(cltr)}`);
      const body = await res.json();
      if (body.ok) {
        l.textContent = "패키지 생성됨 - 탐색기 확인";
        setTimeout(() => { l.textContent = orig; }, 6000);
        return;
      }
      l.textContent = orig;
      alert(`패키지 생성 실패: ${body.error || "알 수 없는 오류"}`);
    } catch (err) {
      l.textContent = orig;
      const cmd = `python -m realestate.rights_pack ${cltr}`;
      try { await navigator.clipboard.writeText(cmd); } catch (e2) { /* 무시 */ }
      alert(
        "로컬 헬퍼에 연결할 수 없습니다.\n\n" +
        "PC에서 헬퍼를 실행한 뒤 다시 클릭하세요:\n" +
        "  python -m realestate.rights_server\n\n" +
        `또는 1회 생성 명령(클립보드에 복사됨):\n  ${cmd}`);
    }
  });

  /* ---------------- dispatch ---------------- */
  const inits = { listings: initListings, results: initResults, stats: initStats, costs: initCosts, regions: initRegions };
  const init = inits[document.body.dataset.page];
  if (init) {
    try { init(); } catch (e) {
      const el = $("#list") || $("#meta") || document.body;
      el.textContent = "데이터 로드 실패 — data/*.js 가 없거나 손상됨";
    }
  }
})();
