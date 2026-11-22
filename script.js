
const scene = document.getElementById("orbitScene");
const exploreButton = document.getElementById("exploreButton");
const overlay = document.getElementById("detailOverlay");
const closeButton = document.getElementById("closeButton");
const title = document.getElementById("detailTitle");
const eyebrow = document.getElementById("detailEyebrow");
const body = document.getElementById("detailBody");
const nav = document.getElementById("detailNav");

const profileAbout = document.getElementById("profileAbout");
const profileKeywords = document.getElementById("profileKeywords");
const profileAvatar = document.getElementById("profileAvatar");
const profileContact = document.getElementById("profileContact");
const loader = document.getElementById("loader");

const API_URL = "/api/portfolio";

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

let portfolioData = null;
let activeEntries = [];
let activeIndex = 0;
let currentKey = "about";

const sleep = ms =>
  new Promise(resolve => setTimeout(resolve, ms));

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

    const url = safeUrl(item.href || item.text?.link?.url);

    if (url) {
      const external = /^https?:/i.test(url);
      value = `<a href="${esc(url)}"
        ${external ? 'target="_blank" rel="noopener noreferrer"' : ""}>${value}</a>`;
    }

    return value;
  }).join("");
}

/* NOTION BLOCKS */

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
      return `<details><summary>${content}</summary>${children}</details>`;

    case "child_page":
      return `<h3>${esc(data.title || "Untitled page")}</h3>`;

    case "bookmark":
    case "embed": {
      const url = safeUrl(data.url);
      return url
        ? `<p><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(data.url)}</a></p>`
        : "";
    }

    case "image":
    case "file":
    case "pdf": {
      const file = data.file?.url || data.external?.url;
      return file
        ? `<figure class="article-inline-image">
            <img src="${esc(file)}" alt="${esc(data.caption?.[0]?.plain_text || "Portfolio image")}" loading="lazy">
            <figcaption>${rich(data.caption || [])}</figcaption>
          </figure>`
        : "";
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
    if (listType) {
      output += `<${listType}>${items.join("")}</${listType}>`;
      listType = null;
      items = [];
    }
  }

  for (const block of blocks) {
    if (
      block.type === "bulleted_list_item" ||
      block.type === "numbered_list_item"
    ) {
      const type = block.type === "bulleted_list_item" ? "ul" : "ol";

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

/* NOTION PROPERTIES */

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

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
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
  if (!property) return [];

  if (property.type === "files") {
    return (property.files || []).map(file =>
      file.file?.url || file.external?.url || ""
    ).filter(Boolean);
  }

  return [];
}

function imageProperty(page, terms) {
  return fileUrls(propertyByMatch(page, terms));
}

function imageMarkup(url, alt, className = "article-inline-image") {
  if (!url) return "";

  return `<figure class="${className}">
    <img src="${esc(url)}" alt="${esc(alt)}" loading="lazy">
    <figcaption>${esc(alt)}</figcaption>
  </figure>`;
}

function propertyMarkup(key, property) {
  const value = propText(property);
  if (!value) return "";

  if (property.type === "url") {
    const url = safeUrl(value);
    if (url) {
      return `<p><strong>${esc(key)}:</strong>
        <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(value)}</a></p>`;
    }
  }

  if (property.type === "email") {
    return `<p><strong>${esc(key)}:</strong>
      <a href="mailto:${encodeURIComponent(value)}">${esc(value)}</a></p>`;
  }

  if (property.type === "phone_number") {
    return `<p><strong>${esc(key)}:</strong>
      <a href="tel:${esc(value)}">${esc(value)}</a></p>`;
  }

  return `<p><strong>${esc(key)}:</strong> ${esc(value)}</p>`;
}

/* PROFILE */

function applyProfile() {
  const rows = portfolioData?.databases?.profile?.results || [];
  if (!rows.length) return;

  const page = rows[0];

  const about = propertyValue(page, [
    "aboutme", "about", "bio", "summary", "description"
  ]);

  if (about) profileAbout.textContent = about;

  const keywords = propertyByMatch(page, [
    "keyword", "keywords", "focus", "tags"
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
    profileKeywords.innerHTML = keywordList.slice(0, 5)
      .map(item => `<span>${esc(item)}</span>`)
      .join("");
  }

  const frontPhoto = imageProperty(page, [
    "frontphoto", "landingphoto", "profilephoto", "avatar"
  ])[0];

  if (frontPhoto) {
    profileAvatar.innerHTML =
      `<img src="${esc(frontPhoto)}" alt="Faiq Abdillah"><i></i>`;
  }

  const logo = imageProperty(page, [
    "portfoliologo", "brandlogo", "logo"
  ])[0];

  if (logo) {
    document.getElementById("brandLogo").innerHTML =
      `<img src="${esc(logo)}" alt="Portfolio logo">`;
  }
}

/* ENTRY CONTENT */

function entryContent(page, source) {
  let output = "";

  // Logo aplikasi khusus proyek
  if (source === "projects") {
    const logo = imageProperty(page, [
      "applogo", "projectlogo", "logo"
    ])[0];

    if (logo) {
      output += `<img class="article-appmark"
        src="${esc(logo)}" alt="Application logo">`;
    }
  }

  // Foto khusus About Me, terpisah dari foto landing
  if (source === "profile") {
    const aboutPhoto = imageProperty(page, [
      "aboutphoto", "aboutimage", "biophoto"
    ])[0];

    if (aboutPhoto) {
      output += imageMarkup(
        aboutPhoto,
        "Faiq Abdillah",
        "article-hero"
      );
    }
  }

  // Galeri foto proyek
  if (source === "projects") {
    const gallery = imageProperty(page, [
      "projectgallery", "gallery", "screenshots", "projectimages"
    ]);

    if (gallery.length) {
      output += `<div class="article-gallery">
        ${gallery.map((url, index) => `
          <figure>
            <img src="${esc(url)}"
              alt="Project image ${index + 1}"
              loading="lazy">
            <figcaption>FIG. ${String(index + 1).padStart(2, "0")}</figcaption>
          </figure>
        `).join("")}
      </div>`;
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
    </p>`;
}

/* GET SECTION ENTRIES */

function getEntries(key) {
  const section = sections[key];
  if (!section || !portfolioData) return [];

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

/* SIDEBAR */

function renderSidebar() {
  nav.innerHTML = "";

  activeEntries.forEach((entry, index) => {
    const button = document.createElement("button");

    button.className =
      "detail-nav-item" + (index === activeIndex ? " is-active" : "");

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
    nav.innerHTML =
      '<span class="detail-nav-item is-active">Overview</span>';
  }
}

/* RENDER ARTICLE */

function renderActive() {
  const item = activeEntries[activeIndex];

  if (!item) {
    body.innerHTML = `
      <p class="article-kicker">PORTFOLIO / 2026</p>
      <p>${esc(sections[currentKey].fallback)}</p>
    `;
  } else {
    body.innerHTML = `
      <p class="article-kicker">
        ${esc(item.source)} · ${String(activeIndex + 1).padStart(2, "0")}
      </p>
      <h3>${esc(item.title)}</h3>
      ${entryContent(item.page, item.source)}
    `;
  }

  body.scrollTop = 0;

  nav.querySelectorAll(".detail-nav-item")
    .forEach((button, index) => {
      button.classList.toggle("is-active", index === activeIndex);
    });

  const activeButton = nav.querySelector(".is-active");

  if (activeButton) {
    activeButton.scrollIntoView({
      block: "nearest",
      behavior: "smooth"
    });
  }
}

/* OPEN POPUP */

function openSection(key) {
  const section = sections[key];
  if (!section) return;

  currentKey = key;
  activeEntries = getEntries(key);
  activeIndex = 0;

  eyebrow.textContent =
    `Portfolio | Section ${section.number} : ${section.title}`;

  title.textContent = section.title;

  renderSidebar();
  renderActive();

  overlay.classList.add("is-visible");
  overlay.setAttribute("aria-hidden", "false");

  closeButton.focus();
}

/* CLOSE POPUP */

function closeSection() {
  overlay.classList.remove("is-visible");
  overlay.setAttribute("aria-hidden", "true");
}

/* PROFILE CONTACT */

profileContact.addEventListener("click", () => {
  openSection("contact");
});

/* EXPLORE / HIDE NAVIGATION */

exploreButton.addEventListener("click", () => {
  const isOpen = scene.classList.toggle("is-open");

  exploreButton.querySelector("span").textContent =
    isOpen ? "Hide navigation" : "Spread to Know";

  exploreButton.querySelector("b").textContent =
    isOpen ? "×" : "↗";
});

/* NAVIGATION CARDS */

document.querySelectorAll(".nav-card").forEach(card => {
  card.addEventListener("click", () => {
    openSection(card.dataset.section);
  });
});

closeButton.addEventListener("click", closeSection);

overlay.addEventListener("click", event => {
  if (event.target === overlay) closeSection();
});

/* SIDEBAR ARROW CONTROLS */

document.getElementById("sidebarUp").addEventListener("click", () => {
  nav.scrollBy({ top: -130, behavior: "smooth" });
});

document.getElementById("sidebarDown").addEventListener("click", () => {
  nav.scrollBy({ top: 130, behavior: "smooth" });
});

/* KEYBOARD */

document.addEventListener("keydown", event => {
  if (event.key === "Escape" &&
      overlay.classList.contains("is-visible")) {
    closeSection();
  }

  if (!overlay.classList.contains("is-visible")) return;

  if (event.key === "ArrowDown" && event.altKey) {
    event.preventDefault();
    activeIndex = Math.min(activeIndex + 1, activeEntries.length - 1);
    renderActive();
  }

  if (event.key === "ArrowUp" && event.altKey) {
    event.preventDefault();
    activeIndex = Math.max(activeIndex - 1, 0);
    renderActive();
  }
});

/* LOAD NOTION */

async function loadPortfolio() {
  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error("Portfolio API unavailable");
    }

    const data = await response.json();

    if (!data.success || !data.databases) {
      throw new Error("Invalid portfolio response");
    }

    portfolioData = data;
    applyProfile();

    if (overlay.classList.contains("is-visible")) {
      openSection(currentKey);
    }

    console.log("Portfolio data loaded");

  } catch (error) {
    console.error("Portfolio loading error:", error);
  }
}

/* INITIAL LOADING SCREEN */

async function initializePortfolio() {
  const start = Date.now();

  await Promise.all([
    loadPortfolio(),
    sleep(5000)
  ]);

  const remaining = Math.max(0, 5000 - (Date.now() - start));

  if (remaining) await sleep(remaining);

  loader.classList.add("is-gone");

  setTimeout(() => {
    loader?.remove();
  }, 900);
}

initializePortfolio();
