
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
    title: "About me",
    databases: ["profile"],
    fallback: "<p>Discover my background, professional focus, and personal journey.</p>"
  },
  education: {
    number: "02",
    title: "Education & Research",
    databases: ["education", "research"],
    fallback: "<p>My academic journey and research contributions.</p>"
  },
  experience: {
    number: "03",
    title: "Experience",
    databases: ["experience"],
    fallback: "<p>Professional experiences and responsibilities.</p>"
  },
  policy: {
    number: "04",
    title: "Policy interests",
    databases: ["interests"],
    fallback: "<p>Environmental policy, governance, and strategic management.</p>"
  },
  projects: {
    number: "05",
    title: "Selected projects",
    databases: ["projects"],
    fallback: "<p>Projects and initiatives I have contributed to.</p>"
  },
  impact: {
    number: "06",
    title: "Leadership & impact",
    databases: ["leadership"],
    fallback: "<p>Leadership, community engagement, and initiatives.</p>"
  },
  achievements: {
    number: "07",
    title: "Achievements & Skills",
    databases: ["achievements", "skills"],
    fallback: "<p>Certifications, achievements, and professional skills.</p>"
  },
  contact: {
    number: "08",
    title: "Contact",
    databases: ["contact"],
    fallback: "<p>Let's connect and explore opportunities to collaborate.</p>"
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

function extractText(value) {
  if (!value) return "";

  if (Array.isArray(value)) {
    return value.map(item => item.plain_text || "").join("");
  }

  return "";
}

function extractProperty(property) {
  if (!property) return "";

  switch (property.type) {
    case "title":
      return extractText(property.title);
    case "rich_text":
      return extractText(property.rich_text);
    case "number":
      return property.number ?? "";
    case "select":
      return property.select?.name || "";
    case "status":
      return property.status?.name || "";
    case "multi_select":
      return property.multi_select?.map(item => item.name).join(", ") || "";
    case "date":
      return property.date?.start || "";
    case "url":
      return property.url || "";
    case "email":
      return property.email || "";
    case "phone_number":
      return property.phone_number || "";
    case "checkbox":
      return property.checkbox ? "Yes" : "No";
    default:
      return "";
  }
}

function getPageTitle(properties) {
  for (const property of Object.values(properties || {})) {
    if (property.type === "title") {
      return extractText(property.title);
    }
  }
  return "Untitled";
}

function formatPage(page) {
  const properties = page.properties || {};
  const titleText = getPageTitle(properties);

  const fields = Object.entries(properties)
    .map(([name, property]) => ({
      name,
      value: extractProperty(property)
    }))
    .filter(item => item.value !== "" && item.value !== "No");

  return `
    <article class="notion-entry">
      <h3>${escapeHTML(titleText)}</h3>
      ${fields
        .filter(field => field.value !== titleText)
        .map(field => `
          <p>
            <strong>${escapeHTML(field.name)}:</strong>
            ${escapeHTML(field.value)}
          </p>
        `).join("")}
    </article>
  `;
}

function renderDatabase(name) {
  const database = portfolioData?.databases?.[name];

  if (!database?.success || !database.results?.length) {
    return `<p class="empty-state">No published entries available yet.</p>`;
  }

  return database.results.map(formatPage).join("");
}

function renderSection(key) {
  const section = sections[key];

  if (!section) return "";

  const content = section.databases
    .map(renderDatabase)
    .join("");

  return content || section.fallback;
}

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

function closeSection() {
  overlay.classList.remove("is-visible");
  overlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

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
    console.log("Portfolio data loaded successfully", data);

  } catch (error) {
    console.error("Portfolio loading error:", error);
    portfolioData = null;
  }
}

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
  if (event.target === overlay) closeSection();
});

document.addEventListener("keydown", event => {
  if (
    event.key === "Escape" &&
    overlay.classList.contains("is-visible")
  ) {
    closeSection();
  }
});

loadPortfolio();
