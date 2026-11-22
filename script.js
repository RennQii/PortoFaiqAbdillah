
const scene = document.getElementById("orbitScene");
const exploreButton = document.getElementById("exploreButton");
const overlay = document.getElementById("detailOverlay");
const closeButton = document.getElementById("closeButton");
const title = document.getElementById("detailTitle");
const eyebrow = document.getElementById("detailEyebrow");
const body = document.getElementById("detailBody");

const API_URL = "/api/portfolio";

const sections = {
  about: {
    number: "01",
    title: "About Me",
    databases: ["profile"],
    fallback: "Discover my background, professional focus, and personal journey."
  },
  education: {
    number: "02",
    title: "Education & Research",
    databases: ["education", "research"],
    fallback: "My academic journey and research contributions."
  },
  experience: {
    number: "03",
    title: "Professional Experience",
    databases: ["experience"],
    fallback: "Professional experiences and responsibilities."
  },
  policy: {
    number: "04",
    title: "Policy & Interests",
    databases: ["interests"],
    fallback: "Environmental policy, governance, and strategic management."
  },
  projects: {
    number: "05",
    title: "Selected Projects",
    databases: ["projects"],
    fallback: "Projects and initiatives I have contributed to."
  },
  impact: {
    number: "06",
    title: "Leadership & Impact",
    databases: ["leadership"],
    fallback: "Leadership, community engagement, and initiatives."
  },
  achievements: {
    number: "07",
    title: "Achievements & Certifications",
    databases: ["achievements"],
    fallback: "Awards, certifications, and recognition."
  },
  skills: {
    number: "08",
    title: "Skills & Expertise",
    databases: ["skills"],
    fallback: "Professional capabilities and areas of expertise."
  },
  contact: {
    number: "09",
    title: "Contact Me",
    databases: ["contact"],
    fallback: "Let's connect and explore opportunities to collaborate."
  }
};

let portfolioData = null;

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

// RICH TEXT RENDERER
function renderRichText(items = []) {
  return items.map(item => {
    let text = escapeHTML(
      item.plain_text || item.text?.content || ""
    );

    const annotations = item.annotations || {};

    if (annotations.code) text = `<code>${text}</code>`;
    if (annotations.bold) text = `<strong>${text}</strong>`;
    if (annotations.italic) text = `<em>${text}</em>`;
    if (annotations.underline) text = `<u>${text}</u>`;
    if (annotations.strikethrough) text = `<s>${text}</s>`;

    const url = item.href || item.text?.link?.url;

    if (url && /^(https?:\/\/|mailto:)/i.test(url)) {
      text = `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    }

    return text;
  }).join("");
}

// NOTION BLOCK RENDERER
function renderBlock(block) {
  const type = block.type;
  const data = block[type] || {};

  const richText = renderRichText(data.rich_text || []);
  const children = block.children?.length
    ? renderBlocks(block.children)
    : "";

  switch (type) {
    case "paragraph":
      return richText ? `<p>${richText}</p>${children}` : children;

    case "heading_1":
      return `<h2>${richText}</h2>${children}`;

    case "heading_2":
      return `<h3>${richText}</h3>${children}`;

    case "heading_3":
      return `<h4>${richText}</h4>${children}`;

    case "bulleted_list_item":
      return `<li>${richText}${children}</li>`;

    case "numbered_list_item":
      return `<li>${richText}${children}</li>`;

    case "quote":
      return `<blockquote>${richText}${children}</blockquote>`;

    case "callout":
      return `<aside class="notion-callout">${richText}${children}</aside>`;

    case "divider":
      return "<hr>";

    case "to_do":
      return `<p class="notion-todo">${data.checked ? "☑" : "☐"} ${richText}</p>${children}`;

    case "toggle":
      return `<details><summary>${richText}</summary>${children}</details>`;

    case "bookmark": {
      const url = data.url || "";
      if (!/^https?:\/\//i.test(url)) return "";
      return `<p class="notion-bookmark"><a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(url)}</a></p>`;
    }

    case "embed": {
      const url = data.url || "";
      if (!/^https?:\/\//i.test(url)) return "";
      return `<p><a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">Open embedded content ↗</a></p>`;
    }

    case "child_page":
      return `<h3>${escapeHTML(data.title || "Untitled page")}</h3>`;

    default:
      return children;
  }
}

// GROUP CONSECUTIVE LIST ITEMS
function renderBlocks(blocks = []) {
  let html = "";
  let currentList = null;
  let listItems = [];

  function flushList() {
    if (!currentList) return;

    html += `<${currentList}>${listItems.join("")}</${currentList}>`;
    currentList = null;
    listItems = [];
  }

  for (const block of blocks) {
    if (block.type === "bulleted_list_item") {
      if (currentList !== "ul") {
        flushList();
        currentList = "ul";
      }

      listItems.push(renderBlock(block));
      continue;
    }

    if (block.type === "numbered_list_item") {
      if (currentList !== "ol") {
        flushList();
        currentList = "ol";
      }

      listItems.push(renderBlock(block));
      continue;
    }

    flushList();
    html += renderBlock(block);
  }

  flushList();
  return html;
}

// GET NOTION PAGE TITLE
function getPageTitle(properties) {
  for (const property of Object.values(properties || {})) {
    if (property.type === "title") {
      return (property.title || [])
        .map(item => item.plain_text || "")
        .join("");
    }
  }

  return "Untitled";
}

// RENDER NOTION ENTRY
function formatPage(page) {
  const titleText = getPageTitle(page.properties);

  const pageContent = page.content?.length
    ? `<div class="notion-entry-content">${renderBlocks(page.content)}</div>`
    : "";

  return `
    <article class="notion-entry">
      <h3>${escapeHTML(titleText)}</h3>
      ${pageContent}
    </article>
  `;
}

// RENDER DATABASE
function renderDatabase(name) {
  const database = portfolioData?.databases?.[name];

  if (!database?.success) {
    return `<p class="empty-state">Unable to load this section.</p>`;
  }

  if (!database.results?.length) {
    return `<p class="empty-state">No entries available yet.</p>`;
  }

  return database.results.map(formatPage).join("");
}

// RENDER SECTION
function renderSection(key) {
  const section = sections[key];

  if (!section) return "";

  const content = section.databases
    .map(renderDatabase)
    .join("");

  return content || `<p>${escapeHTML(section.fallback)}</p>`;
}

// OPEN DETAIL PANEL
function openSection(key) {
  const item = sections[key];

  if (!item) return;

  eyebrow.textContent = `SECTION ${item.number} / PORTFOLIO`;
  title.textContent = item.title;

  body.innerHTML = portfolioData
    ? renderSection(key)
    : `<p>Portfolio content is currently unavailable. Please try again later.</p>`;

  overlay.classList.add("is-visible");
  overlay.setAttribute("aria-hidden", "false");

  document.body.style.overflow = "hidden";
  closeButton.focus();
}

// CLOSE DETAIL PANEL
function closeSection() {
  overlay.classList.remove("is-visible");
  overlay.setAttribute("aria-hidden", "true");

  document.body.style.overflow = "";
}

// LOAD NOTION DATA
async function loadPortfolio() {
  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error("Unable to load portfolio data");
    }

    const data = await response.json();

    if (!data.success || !data.databases) {
      throw new Error("Invalid portfolio response");
    }

    portfolioData = data;
    document.documentElement.classList.add("notion-connected");

    if (overlay.classList.contains("is-visible")) {
      const activeSection = Object.keys(sections).find(
        key => title.textContent === sections[key].title
      );

      if (activeSection) {
        body.innerHTML = renderSection(activeSection);
      }
    }

    console.log("Portfolio data loaded successfully");

  } catch (error) {
    console.error("Portfolio loading error:", error);
    portfolioData = null;
  }
}

// EXPLORE BUTTON
exploreButton.addEventListener("click", () => {
  const isOpen = scene.classList.toggle("is-open");

  exploreButton.querySelector("span").textContent =
    isOpen ? "Hide navigation" : "Explore portfolio";

  exploreButton.querySelector("b").textContent =
    isOpen ? "×" : "↗";
});

// NAVIGATION CARDS
document.querySelectorAll(".nav-card").forEach(card => {
  card.addEventListener("click", () => {
    openSection(card.dataset.section);
  });
});

// CLOSE BUTTON
closeButton.addEventListener("click", closeSection);

// CLOSE WHEN CLICKING OUTSIDE PANEL
overlay.addEventListener("click", event => {
  if (event.target === overlay) {
    closeSection();
  }
});

// ESCAPE KEY
document.addEventListener("keydown", event => {
  if (
    event.key === "Escape" &&
    overlay.classList.contains("is-visible")
  ) {
    closeSection();
  }
});

// INITIALIZE
loadPortfolio();
