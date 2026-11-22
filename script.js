
/* =========================================================
   FAIQ ABDILLAH — PERSONAL PORTFOLIO
   PARALLEL LOADING SYSTEM
   CRITICAL + BACKGROUND WORKERS
========================================================= */

const $ = selector => document.querySelector(selector);

const scene = $("#orbitScene");
const exploreButton = $("#exploreButton");
const overlay = $("#detailOverlay");
const closeButton = $("#closeButton");
const title = $("#detailTitle");
const eyebrow = $("#detailEyebrow");
const articleBody = $("#detailBody");
const nav = $("#detailNav");

const profileAbout = $("#profileAbout");
const profileKeywords = $("#profileKeywords");
const profileAvatar = $("#profileAvatar");
const profileContact = $("#profileContact");
const loader = $("#loader");
const loaderLine = $(".loader-line");

const API_URL = "/api/portfolio";
const MAX_LOADING_TIME = 8000;

const sections = {
  about: {
    number: 1,
    title: "About",
    databases: ["profile"],
    fallback: "The person behind the work."
  },
  education: {
    number: 2,
    title: "Education",
    databases: ["education", "research"],
    fallback: "Academic journey and research."
  },
  experience: {
    number: 3,
    title: "Professional Experience",
    databases: ["experience"],
    fallback: "Professional experiences and responsibilities."
  },
  policy: {
    number: 4,
    title: "Policy & Interests",
    databases: ["interests"],
    fallback: "Environmental policy, governance, and strategic management."
  },
  projects: {
    number: 5,
    title: "Selected Projects",
    databases: ["projects"],
    fallback: "Projects and initiatives."
  },
  impact: {
    number: 6,
    title: "Leadership & Impact",
    databases: ["leadership"],
    fallback: "Leadership, community engagement, and initiatives."
  },
  achievements: {
    number: 7,
    title: "Achievements & Certifications",
    databases: ["achievements"],
    fallback: "Awards, certifications, and recognition."
  },
  skills: {
    number: 8,
    title: "Skills & Expertise",
    databases: ["skills"],
    fallback: "Professional capabilities and expertise."
  },
  contact: {
    number: 9,
    title: "Contact Me",
    databases: ["contact"],
    fallback: "Let's connect and explore opportunities."
  }
};


/* =========================================================
   GLOBAL STATE
========================================================= */

let portfolioData = {
  success: true,
  databases: {}
};

let activeEntries = [];
let activeIndex = 0;
let currentKey = "about";
let articleCache = {};

let loaderFinished = false;
let backgroundReady = false;
let criticalReady = false;

let criticalTask = null;
let backgroundTask = null;


/* =========================================================
   HELPERS
========================================================= */

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function safeUrl(value) {
  if (!value) return "";

  try {
    const url = new URL(value);

    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol)
      ? url.href
      : "";
  } catch {
    return "";
  }
}

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}


/* =========================================================
   LOADING PROGRESS
========================================================= */

function updateProgress(percent) {
  if (!loaderLine || loaderFinished) return;

  const value = Math.max(0, Math.min(100, percent));

  loaderLine.style.animation = "none";
  loaderLine.style.transformOrigin = "left";
  loaderLine.style.transform = `scaleX(${value / 100})`;
  loaderLine.style.background = "#f1cb57";

  const label = loader?.querySelector("small");

  if (label) {
    label.textContent =
      `LOADING PORTFOLIO · ${Math.floor(value)}%`;
  }
}


/* =========================================================
   NOTION RICH TEXT
========================================================= */

function rich(items = []) {
  return items.map(item => {
    let value = esc(
      item.plain_text || item.text?.content || ""
    );

    const a = item.annotations || {};

    if (a.code) value = `<code>${value}</code>`;
    if (a.bold) value = `<strong>${value}</strong>`;
    if (a.italic) value = `<em>${value}</em>`;
    if (a.underline) value = `<u>${value}</u>`;
    if (a.strikethrough) value = `<s>${value}</s>`;

    const url = safeUrl(
      item.href || item.text?.link?.url
    );

    if (url) {
      const external = /^https?:/i.test(url);

      value = `<a href="${esc(url)}"
        ${external ? 'target="_blank" rel="noopener noreferrer"' : ""}>
        ${value}
      </a>`;
    }

    return value;
  }).join("");
}


/* =========================================================
   NOTION BLOCK RENDERER
========================================================= */

function renderBlock(block) {
  const data = block[block.type] || {};
  const content = rich(data.rich_text || []);

  const children = block.children?.length
    ? renderBlocks(block.children)
    : "";

  switch (block.type) {
    case "paragraph":
      return content ? `<p>${content}</p>${children}` : children;

    case "heading_1":
      return `<h2>${content}</h2>${children}`;

    case "heading_2":
      return `<h3>${content}</h3>${children}`;

    case "heading_3":
      return `<h4>${content}</h4>${children}`;

    case "bulleted_list_item":
    case "numbered_list_item":
      return `<li>${content}${children}</li>`;

    case "quote":
    case "callout":
      return `<blockquote>${content}${children}</blockquote>`;

    case "divider":
      return "<hr>";

    case "to_do":
      return `<p>${data.checked ? "☑" : "☐"} ${content}</p>`;

    case "toggle":
      return `<details>
        <summary>${content}</summary>
        ${children}
      </details>`;

    case "child_page":
      return `<h3>${esc(data.title || "Untitled page")}</h3>`;

    case "bookmark":
    case "embed": {
      const url = safeUrl(data.url);

      return url
        ? `<p><a href="${esc(url)}" target="_blank"
            rel="noopener noreferrer">${esc(data.url)}</a></p>`
        : "";
    }

    case "image":
    case "file":
    case "pdf": {
      const file = data.file?.url || data.external?.url;

      if (!file) return "";

      const caption = rich(data.caption || []);

      return `
        <figure class="article-inline-image">
          <img
            src="${esc(file)}"
            alt="${esc(data.caption?.[0]?.plain_text || "Portfolio image")}"
            loading="lazy"
            decoding="async"
          >
          <figcaption>${caption}</figcaption>
        </figure>
      `;
    }

    default:
      return children;
  }
}


function renderBlocks(blocks = []) {
  let output = "";
  let listType = null;
  let items = [];

  function flush() {
    if (!listType) return;

    output += `<${listType}>${items.join("")}</${listType}>`;
    listType = null;
    items = [];
  }

  for (const block of blocks) {
    if (
      block.type === "bulleted_list_item" ||
      block.type === "numbered_list_item"
    ) {
      const type =
        block.type === "bulleted_list_item" ? "ul" : "ol";

      if (listType !== type) {
        flush();
        listType = type;
      }

      items.push(renderBlock(block));
    } else {
      flush();
      output += renderBlock(block);
    }
  }

  flush();

  return output;
}


/* =========================================================
   NOTION PROPERTIES
========================================================= */

function propText(property) {
  if (!property) return "";

  switch (property.type) {
    case "title":
    case "rich_text":
      return (property[property.type] || [])
        .map(item => item.plain_text || item.text?.content || "")
        .join("");

    case "email":
    case "url":
    case "phone_number":
      return property[property.type] || "";

    case "select":
      return property.select?.name || "";

    case "multi_select":
      return (property.multi_select || [])
        .map(item => item.name)
        .join("|");

    case "number":
      return String(property.number ?? "");

    case "checkbox":
      return property.checkbox ? "Yes" : "No";

    case "date":
      return property.date?.start || "";

    default:
      return "";
  }
}


function pageTitle(page) {
  for (const property of Object.values(page.properties || {})) {
    if (property.type === "title") return propText(property);
  }

  return "Untitled";
}


function propertyByMatch(page, terms) {
  for (const [key, value] of Object.entries(page?.properties || {})) {
    const name = normalize(key);

    if (terms.some(term => name.includes(normalize(term)))) {
      return value;
    }
  }

  return null;
}


function propertyValue(page, terms) {
  return propText(propertyByMatch(page, terms));
}


function fileUrls(property) {
  if (!property || property.type !== "files") return [];

  return (property.files || [])
    .map(file => file.file?.url || file.external?.url || "")
    .filter(Boolean);
}


function imageProperty(page, terms) {
  return fileUrls(propertyByMatch(page, terms));
}


function imageMarkup(url, alt, className = "article-inline-image") {
  if (!url) return "";

  return `
    <figure class="${className}">
      <img src="${esc(url)}"
        alt="${esc(alt)}"
        loading="lazy"
        decoding="async">
      <figcaption>${esc(alt)}</figcaption>
    </figure>
  `;
}


function propertyMarkup(key, property) {
  const value = propText(property);

  if (!value) return "";

  if (property.type === "url") {
    const url = safeUrl(value);

    if (url) {
      return `
        <p><strong>${esc(key)}:</strong>
          <a href="${esc(url)}" target="_blank"
            rel="noopener noreferrer">${esc(value)}</a>
        </p>
      `;
    }
  }

  if (property.type === "email") {
    return `
      <p><strong>${esc(key)}:</strong>
        <a href="mailto:${encodeURIComponent(value)}">${esc(value)}</a>
      </p>
    `;
  }

  if (property.type === "phone_number") {
    return `
      <p><strong>${esc(key)}:</strong>
        <a href="tel:${esc(value)}">${esc(value)}</a>
      </p>
    `;
  }

  return `<p><strong>${esc(key)}:</strong> ${esc(value)}</p>`;
}


/* =========================================================
   PROFILE DATA
========================================================= */

function applyProfile() {
  const rows = portfolioData?.databases?.profile?.results || [];

  if (!rows.length) return;

  const page = rows[0];

  const about = propertyValue(page, [
    "aboutme",
    "about",
    "bio",
    "summary",
    "description"
  ]);

  if (about) {
    profileAbout.textContent = about;
  }

  const keywords = propertyByMatch(page, [
    "keyword",
    "keywords",
    "focus",
    "tags"
  ]);

  let keywordList = [];

  if (keywords?.type === "multi_select") {
    keywordList = keywords.multi_select.map(item => item.name);
  } else if (keywords?.type === "rich_text") {
    keywordList = keywords.rich_text
      .map(item => item.plain_text)
      .join(",")
      .split(/[,;|]/)
      .map(item => item.trim())
      .filter(Boolean);
  }

  if (keywordList.length) {
    profileKeywords.innerHTML = keywordList
      .slice(0, 5)
      .map(item => `<span>${esc(item)}</span>`)
      .join("");
  }

  const frontPhoto = imageProperty(page, [
    "frontphoto",
    "landingphoto",
    "profilephoto",
    "avatar"
  ])[0];

  if (frontPhoto) {
    profileAvatar.innerHTML = `
      <img src="${esc(frontPhoto)}"
        alt="Faiq Abdillah"
        loading="eager"
        decoding="async">
      <i></i>
    `;
  }

  const logo = imageProperty(page, [
    "portfoliologo",
    "brandlogo",
    "logo"
  ])[0];

  if (logo) {
    $("#brandLogo").innerHTML = `
      <img src="${esc(logo)}" alt="Portfolio logo">
    `;
  }
}


/* =========================================================
   ARTICLE CONTENT
========================================================= */

function entryContent(page, source) {
  let output = "";

  if (source === "projects") {
    const logo = imageProperty(page, [
      "applogo",
      "projectlogo",
      "logo"
    ])[0];

    if (logo) {
      output += `
        <img class="article-appmark"
          src="${esc(logo)}"
          alt="Application logo"
          loading="lazy"
          decoding="async">
      `;
    }

    const gallery = imageProperty(page, [
      "projectgallery",
      "gallery",
      "screenshots",
      "projectimages"
    ]);

    if (gallery.length) {
      output += `
        <div class="article-gallery">
          ${gallery.map((url, index) => `
            <figure>
              <img src="${esc(url)}"
                alt="Project image ${index + 1}"
                loading="lazy"
                decoding="async">
              <figcaption>
                FIG. ${String(index + 1).padStart(2, "0")}
              </figcaption>
            </figure>
          `).join("")}
        </div>
      `;
    }
  }

  if (source === "profile") {
    const aboutPhoto = imageProperty(page, [
      "aboutphoto",
      "aboutimage",
      "biophoto"
    ])[0];

    if (aboutPhoto) {
      output += imageMarkup(
        aboutPhoto,
        "Faiq Abdillah",
        "article-hero"
      );
    }
  }

  output += renderBlocks(page.content || []);

  const properties = Object.entries(page.properties || {})
    .filter(([key, value]) =>
      value.type !== "title" &&
      value.type !== "files" &&
      value.type !== "formula" &&
      propText(value)
    )
    .map(([key, value]) => propertyMarkup(key, value))
    .join("");

  output += properties;

  return output || `
    <p class="empty-state">
      No written detail is available for this entry yet.
    </p>
  `;
}


/* =========================================================
   SECTION DATA
========================================================= */

function getEntries(key) {
  const section = sections[key];

  if (!section) return [];

  const entries = [];

  for (const databaseName of section.databases) {
    const database = portfolioData.databases?.[databaseName];

    if (database?.success) {
      (database.results || []).forEach(page => {
        entries.push({
          title: pageTitle(page),
          source: databaseName,
          page
        });
      });
    }
  }

  return entries;
}


function isSectionReady(key) {
  if (key === "about") {
    return criticalReady;
  }

  return backgroundReady;
}


/* =========================================================
   BUILD ARTICLE CACHE
========================================================= */

function prepareAllArticles() {
  articleCache = {};

  Object.keys(sections).forEach(key => {
    const entries = getEntries(key);

    articleCache[key] = entries.map((item, index) => ({
      ...item,
      html: `
        <p class="article-kicker">
          ${esc(item.source)} · ${String(index + 1).padStart(2, "0")}
        </p>
        <h3>${esc(item.title)}</h3>
        ${entryContent(item.page, item.source)}
      `
    }));
  });
}


/* =========================================================
   IMAGE PRELOADER
========================================================= */

function preloadImage(url) {
  return new Promise(resolve => {
    const img = new Image();
    let finished = false;

    function complete(success) {
      if (finished) return;
      finished = true;
      resolve({ url, success });
    }

    img.onload = () => complete(true);
    img.onerror = () => complete(false);
    img.src = url;

    if (img.complete) {
      complete(img.naturalWidth > 0);
    }
  });
}


async function preloadCriticalImages() {
  const urls = new Set();

  document.querySelectorAll(
    "#profileAvatar img, #brandLogo img"
  ).forEach(img => {
    if (img.src) urls.add(img.src);
  });

  const list = [...urls];

  if (!list.length) {
    updateProgress(90);
    return;
  }

  let completed = 0;

  await Promise.all(
    list.map(async url => {
      await preloadImage(url);

      completed++;

      updateProgress(
        50 + (completed / list.length) * 40
      );
    })
  );
}


/* =========================================================
   SIDEBAR
========================================================= */

function renderSidebar() {
  nav.innerHTML = "";

  activeEntries.forEach((entry, index) => {
    const button = document.createElement("button");

    button.className =
      "detail-nav-item" +
      (index === activeIndex ? " is-active" : "");

    button.innerHTML = `
      <span class="detail-nav-number">
        ${String(index + 1).padStart(2, "0")}
      </span>
      ${esc(entry.title)}
    `;

    button.addEventListener("click", () => {
      activeIndex = index;
      renderActive();
    });

    nav.appendChild(button);
  });

  if (!activeEntries.length) {
    nav.innerHTML = `
      <span class="detail-nav-item is-active">
        Overview
      </span>
    `;
  }
}


/* =========================================================
   RENDER ARTICLE
========================================================= */

function renderActive() {
  if (!isSectionReady(currentKey)) {
    articleBody.innerHTML = `
      <div class="empty-state">
        <p class="article-kicker">LOADING SECTION</p>
        <p>Preparing this section...</p>
      </div>
    `;

    nav.innerHTML = `
      <span class="detail-nav-item is-active">
        Loading...
      </span>
    `;

    return;
  }

  const entries = articleCache[currentKey] || [];
  const item = entries[activeIndex];

  if (!item) {
    articleBody.innerHTML = `
      <p class="article-kicker">PORTFOLIO / 2026</p>
      <p>${esc(sections[currentKey].fallback)}</p>
    `;
  } else {
    articleBody.innerHTML = item.html;
  }

  articleBody.scrollTop = 0;

  nav.querySelectorAll(".detail-nav-item")
    .forEach((button, index) => {
      button.classList.toggle(
        "is-active",
        index === activeIndex
      );
    });

  const activeButton = nav.querySelector(".is-active");

  if (activeButton) {
    activeButton.scrollIntoView({
      block: "nearest",
      behavior: "smooth"
    });
  }
}


/* =========================================================
   OPEN / CLOSE POPUP
========================================================= */

function openSection(key) {
  const section = sections[key];

  if (!section) return;

  currentKey = key;
  activeEntries = getEntries(key);
  activeIndex = 0;

  eyebrow.textContent =
    `Portfolio | Section ${section.number} : ${section.title}`;

  title.textContent = section.title;

  if (isSectionReady(key)) {
    renderSidebar();
  }

  renderActive();

  overlay.classList.add("is-visible");
  overlay.setAttribute("aria-hidden", "false");

  closeButton.focus();
}


function closeSection() {
  overlay.classList.remove("is-visible");
  overlay.setAttribute("aria-hidden", "true");
}


/* =========================================================
   INTERACTIONS
========================================================= */

profileContact.addEventListener("click", () => {
  openSection("contact");
});


exploreButton.addEventListener("click", () => {
  const isOpen = scene.classList.toggle("is-open");

  exploreButton.querySelector("span").textContent =
    isOpen ? "Hide navigation" : "Spread to Know";

  exploreButton.querySelector("b").textContent =
    isOpen ? "×" : "↗";
});


document.querySelectorAll(".nav-card").forEach(card => {
  card.addEventListener("click", () => {
    openSection(card.dataset.section);
  });
});


closeButton.addEventListener("click", closeSection);

overlay.addEventListener("click", event => {
  if (event.target === overlay) closeSection();
});


/* Remove old on-screen sidebar arrows */
$("#sidebarUp")?.closest(".sidebar-controls")?.remove();


/* Keyboard navigation */
document.addEventListener("keydown", event => {
  if (
    event.key === "Escape" &&
    overlay.classList.contains("is-visible")
  ) {
    closeSection();
    return;
  }

  if (!overlay.classList.contains("is-visible")) return;

  if (!isSectionReady(currentKey)) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();

    activeIndex = Math.min(
      activeIndex + 1,
      activeEntries.length - 1
    );

    renderActive();
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();

    activeIndex = Math.max(activeIndex - 1, 0);

    renderActive();
  }
});


/* =========================================================
   API FETCHER
========================================================= */

async function fetchGroup(group) {
  const response = await fetch(
    `${API_URL}?group=${encodeURIComponent(group)}`,
    {
      method: "GET",
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error(
      `${group} API error: ${response.status}`
    );
  }

  const data = await response.json();

  if (!data.success || !data.databases) {
    throw new Error(
      data.error || `Invalid ${group} response`
    );
  }

  return data;
}


/* =========================================================
   CRITICAL WORKER
   PROFILE + FRONT IMAGE + SPREAD DATA
========================================================= */

async function loadCritical() {
  const data = await fetchGroup("critical");

  Object.assign(
    portfolioData.databases,
    data.databases
  );

  criticalReady = true;

  applyProfile();
  prepareAllArticles();

  updateProgress(45);

  // Wait for front photo and brand logo.
  await preloadCriticalImages();

  await waitForFonts();

  updateProgress(97);

  return data;
}


/* =========================================================
   BACKGROUND WORKERS
   ALL POPUP DATABASES
========================================================= */

async function loadBackground() {
  try {
    const data = await fetchGroup("background");

    Object.assign(
      portfolioData.databases,
      data.databases
    );

    backgroundReady = true;

    prepareAllArticles();

    console.log(
      "Background workers completed:",
      Object.keys(data.databases)
    );

    // Refresh an open popup when its data arrives.
    if (overlay.classList.contains("is-visible")) {
      activeEntries = getEntries(currentKey);
      activeIndex = Math.min(
        activeIndex,
        Math.max(0, activeEntries.length - 1)
      );

      renderSidebar();
      renderActive();
    }

    return data;

  } catch (error) {
    console.error("Background loading error:", error);

    // Do not block the rest of the portfolio.
    backgroundReady = true;

    prepareAllArticles();

    if (overlay.classList.contains("is-visible")) {
      activeEntries = getEntries(currentKey);
      renderSidebar();
      renderActive();
    }

    return null;
  }
}


/* =========================================================
   WAIT FOR FONTS
========================================================= */

async function waitForFonts() {
  if (!document.fonts?.ready) return;

  try {
    await document.fonts.ready;
  } catch (error) {
    console.warn("Font loading warning:", error);
  }
}


/* =========================================================
   LOADING SCREEN
========================================================= */

function finishLoading() {
  if (loaderFinished) return;

  updateProgress(100);

  loaderFinished = true;

  loader?.classList.add("is-gone");
  document.body.classList.add("portfolio-ready");

  setTimeout(() => {
    loader?.remove();
  }, 900);
}


function showLoadingError(error) {
  console.error("Critical loading error:", error);

  const message = loader?.querySelector("small");

  if (message) {
    message.textContent =
      "SOME CONTENT COULD NOT BE LOADED · PLEASE REFRESH";
  }

  const heading = loader?.querySelector("h1");

  if (heading) {
    heading.innerHTML = 'Almost <em>there.</em>';
  }

  finishLoading();
}


/* =========================================================
   INITIALIZE PARALLEL SYSTEM
========================================================= */

async function initializePortfolio() {
  updateProgress(5);

  /*
    Both workers start together.

    Critical:
    Profile, front photo, brand logo.

    Background:
    All popup databases.
  */

  criticalTask = loadCritical();

  backgroundTask = loadBackground();

  /*
    Only critical data controls the initial screen.
    Background loading never blocks the homepage.
  */

  const timeoutTask = new Promise(resolve => {
    setTimeout(() => resolve("timeout"), MAX_LOADING_TIME);
  });

  try {
    const result = await Promise.race([
      criticalTask.then(() => "ready"),
      timeoutTask
    ]);

    if (result === "ready") {
      finishLoading();

      console.log(
        "Critical portfolio assets are ready."
      );

    } else {
      console.warn(
        "8-second limit reached. Revealing the portfolio."
      );

      finishLoading();
    }

  } catch (error) {
    showLoadingError(error);
  }
}


/* =========================================================
   START
========================================================= */

initializePortfolio();
