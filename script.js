
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

const API_URL = "/api/portfolio";

const sections = {
  about: {
    number: "1",
    title: "About",
    databases: ["profile"],
    fallback: "A closer look at the person behind the work."
  },
  education: {
    number: "2",
    title: "Education",
    databases: ["education", "research"],
    fallback: "Academic journey and research."
  },
  experience: {
    number: "3",
    title: "Professional Experience",
    databases: ["experience"],
    fallback: "Professional experiences and responsibilities."
  },
  policy: {
    number: "4",
    title: "Policy & Interests",
    databases: ["interests"],
    fallback: "Environmental policy, governance, and strategic management."
  },
  projects: {
    number: "5",
    title: "Selected Projects",
    databases: ["projects"],
    fallback: "Projects and initiatives."
  },
  impact: {
    number: "6",
    title: "Leadership & Impact",
    databases: ["leadership"],
    fallback: "Leadership, community engagement, and initiatives."
  },
  achievements: {
    number: "7",
    title: "Achievements & Certifications",
    databases: ["achievements"],
    fallback: "Awards, certifications, and recognition."
  },
  skills: {
    number: "8",
    title: "Skills & Expertise",
    databases: ["skills"],
    fallback: "Professional capabilities and expertise."
  },
  contact: {
    number: "9",
    title: "Contact Me",
    databases: ["contact"],
    fallback: "Let's connect and explore opportunities."
  }
};

let portfolioData = null;
let activeEntries = [];
let activeIndex = 0;
let currentKey = "about";

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function rich(items = []) {
  return items.map(item => {
    let text = esc(
      item.plain_text || item.text?.content || ""
    );

    const a = item.annotations || {};

    if (a.code) text = `<code>${text}</code>`;
    if (a.bold) text = `<strong>${text}</strong>`;
    if (a.italic) text = `<em>${text}</em>`;
    if (a.underline) text = `<u>${text}</u>`;
    if (a.strikethrough) text = `<s>${text}</s>`;

    const url = item.href || item.text?.link?.url;

    if (url && /^(https?:\/\/|mailto:)/i.test(url)) {
      text = `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    }

    return text;
  }).join("");
}

function renderBlock(block) {
  const data = block[block.type] || {};
  const content = rich(data.rich_text || []);
  const children = block.children?.length
    ? renderBlocks(block.children)
    : "";

  switch (block.type) {
    case "paragraph":
      return content
        ? `<p>${content}</p>${children}`
        : children;

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
      return `<p>${data.checked ? "☑" : "☐"} ${content}</p>${children}`;

    case "toggle":
      return `<details><summary>${content}</summary>${children}</details>`;

    case "child_page":
      return `<h3>${esc(data.title || "Untitled page")}</h3>`;

    case "bookmark":
    case "embed": {
      const url = data.url || "";
      return /^https?:\/\//i.test(url)
        ? `<p><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a></p>`
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
      const type = block.type === "bulleted_list_item"
        ? "ul"
        : "ol";

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

    default:
      return "";
  }
}

function pageTitle(page) {
  for (const property of Object.values(page.properties || {})) {
    if (property.type === "title") {
      return propText(property);
    }
  }

  return "Untitled";
}

function propertyByMatch(page, terms) {
  for (const [key, value] of Object.entries(page?.properties || {})) {
    const normalized = key.toLowerCase().replace(/[^a-z]/g, "");

    if (terms.some(term => normalized.includes(term))) {
      return value;
    }
  }

  return null;
}

function imageFromPage(page) {
  const property = propertyByMatch(page, [
    "photo", "avatar", "image", "picture", "portrait"
  ]);

  if (property?.type === "files" && property.files?.length) {
    return property.files[0].file?.url ||
      property.files[0].external?.url || "";
  }

  return page?.cover?.file?.url ||
    page?.cover?.external?.url || "";
}

/* PROFILE DATABASE */

function applyProfile() {
  const rows = portfolioData?.databases?.profile?.results || [];

  if (!rows.length) return;

  const page = rows[0];

  const about = propertyByMatch(page, [
    "aboutme", "about", "bio", "summary", "description"
  ]);

  const aboutText = propText(about);

  if (aboutText) {
    profileAbout.textContent = aboutText;
  }

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
    profileKeywords.innerHTML = keywordList
      .slice(0, 5)
      .map(item => `<span>${esc(item)}</span>`)
      .join("");
  }

  const image = imageFromPage(page);

  if (image) {
    profileAvatar.innerHTML =
      `<img src="${esc(image)}" alt="Faiq Abdillah"><i></i>`;
  }

  const email = propertyByMatch(page, ["email"]);
  const emailText = propText(email);

  if (emailText) {
    profileContact.href = `mailto:${encodeURIComponent(emailText)}`;
  }
}

/* SECTION CONTENT */

function entryContent(page) {
  const html = renderBlocks(page.content || []);

  const properties = Object.entries(page.properties || {})
    .filter(([key, value]) =>
      value.type !== "title" && propText(value)
    )
    .map(([key, value]) =>
      `<p><strong>${esc(key)}:</strong> ${esc(propText(value))}</p>`
    )
    .join("");

  return html + properties ||
    `<p class="empty-state">No written detail is available for this entry yet.</p>`;
}

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

function renderActive() {
  const item = activeEntries[activeIndex];

  if (!item) {
    body.innerHTML =
      `<p>${esc(sections[currentKey].fallback)}</p>`;
    return;
  }

  body.innerHTML = `
    <p class="article-kicker">
      ${esc(item.source)} · ${String(activeIndex + 1).padStart(2, "0")}
    </p>
    <h3>${esc(item.title)}</h3>
    ${entryContent(item.page)}
  `;

  body.scrollTop = 0;

  nav.querySelectorAll(".detail-nav-item")
    .forEach((button, index) => {
      button.classList.toggle("is-active", index === activeIndex);
    });
}

/* OPEN AND CLOSE POPUP */

function openSection(key) {
  const section = sections[key];

  if (!section) return;

  currentKey = key;
  activeEntries = getEntries(key);
  activeIndex = 0;

  eyebrow.textContent =
    `Portfolio | Section ${section.number} : ${section.title}`;

  title.textContent = section.title;

  nav.innerHTML = "";

  if (activeEntries.length) {
    activeEntries.forEach((entry, index) => {
      const button = document.createElement("button");

      button.className =
        "detail-nav-item" + (index === 0 ? " is-active" : "");

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
  } else {
    nav.innerHTML =
      '<span class="detail-nav-item is-active">Overview</span>';
  }

  renderActive();

  overlay.classList.add("is-visible");
  overlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  closeButton.focus();
}

function closeSection() {
  overlay.classList.remove("is-visible");
  overlay.setAttribute("aria-hidden", "true");

  document.body.style.overflow =
    window.matchMedia("(max-width:700px)").matches
      ? "auto"
      : "hidden";
}

/* NAVIGATION INTERACTION */

exploreButton.addEventListener("click", () => {
  const isOpen = scene.classList.toggle("is-open");

  exploreButton.querySelector("span").textContent =
    isOpen ? "Hide navigation" : "Explore portfolio";

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
  if (event.target === overlay) {
    closeSection();
  }
});

document.addEventListener("keydown", event => {
  if (
    event.key === "Escape" &&
    overlay.classList.contains("is-visible")
  ) {
    closeSection();
  }
});

/* LOAD NOTION API */

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
    portfolioData = null;
  }
}

loadPortfolio();
