const scene = document.getElementById("orbitScene");
const exploreButton = document.getElementById("exploreButton");
const overlay = document.getElementById("detailOverlay");
const closeButton = document.getElementById("closeButton");
const title = document.getElementById("detailTitle");
const eyebrow = document.getElementById("detailEyebrow");
const body = document.getElementById("detailBody");

const sections = {
  about: {
    number: "01", title: "About me",
    content: `<p>I am Faiq Abdillah, an emerging professional interested in the intersection of environmental policy, governance, and strategic public management.</p><p>This portfolio brings together the experiences, projects, and ideas that shape my perspective on creating meaningful public impact.</p><div class="placeholder">PERSONALISE THIS SECTION: Add your short biography, current role, strengths, values, and a professional portrait.</div>`
  },
  education: {
    number: "02", title: "Education",
    content: `<p>A snapshot of the academic journey, learning experiences, and subjects that have shaped my interests.</p><div class="placeholder">ADD YOUR DETAILS: Institution · Degree / programme · Years · Relevant coursework · Thesis or research focus.</div>`
  },
  experience: {
    number: "03", title: "Experience",
    content: `<p>Professional, organisational, and volunteer experiences that demonstrate how I work with people, solve problems, and contribute to shared goals.</p><div class="placeholder">ADD EACH ROLE: Organisation · Position · Period · Key responsibilities · Measurable outcomes.</div>`
  },
  policy: {
    number: "04", title: "Policy interests",
    content: `<p><strong>Environmental policy & governance</strong><br>How institutions, policy instruments, and communities can work together to address environmental challenges.</p><p><strong>Public management & strategic planning</strong><br>How public organisations translate long-term priorities into effective programmes, implementation, and outcomes.</p><div class="placeholder">EXPAND WITH: Policy topics, current questions, reading notes, and issues you want to explore further.</div>`
  },
  projects: {
    number: "05", title: "Selected projects",
    content: `<p>A curated selection of projects, research, campaigns, or initiatives that show how ideas become practical work.</p><div class="placeholder">ADD PROJECT CARDS: Project name · Your role · Challenge · Approach · Outcome · Link to deliverable.</div>`
  },
  impact: {
    number: "06", title: "Leadership & impact",
    content: `<p>Leadership is reflected in the people supported, systems improved, and initiatives brought to life.</p><div class="placeholder">ADD EXAMPLES: Team leadership, programme coordination, stakeholder engagement, community initiatives, and evidence of impact.</div>`
  },
  achievements: {
    number: "07", title: "Achievements",
    content: `<p>A record of recognitions and learning milestones that complement the experience documented elsewhere.</p><div class="placeholder">ADD: Awards · Scholarships · Certifications · Training · Conferences · Publications.</div>`
  },
  contact: {
    number: "08", title: "Contact",
    content: `<p>I am always glad to connect with people working on public policy, environmental governance, strategic management, and meaningful collaboration.</p><div class="placeholder">REPLACE WITH YOUR LINKS:<br>Email: your.email@example.com<br>LinkedIn: linkedin.com/in/yourprofile<br>CV: Add a link to your latest CV.</div>`
  }
};

function openSection(key) {
  const item = sections[key];
  if (!item) return;
  eyebrow.textContent = `SECTION ${item.number} / PORTFOLIO`;
  title.textContent = item.title;
  body.innerHTML = item.content;
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
exploreButton.addEventListener("click", () => {
  const isOpen = scene.classList.toggle("is-open");
  exploreButton.querySelector("span").textContent = isOpen ? "Hide navigation" : "Explore portfolio";
  exploreButton.querySelector("b").textContent = isOpen ? "×" : "↗";
});
document.querySelectorAll(".nav-card").forEach(card => {
  card.addEventListener("click", () => openSection(card.dataset.section));
});
closeButton.addEventListener("click", closeSection);
overlay.addEventListener("click", event => {
  if (event.target === overlay) closeSection();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && overlay.classList.contains("is-visible")) closeSection();
});
