
/* =========================================================
   FAIQ ABDILLAH — PORTFOLIO API
   PARALLEL DATABASE WORKERS
========================================================= */

const DATABASES = {
  profile: "41ec968cd031806a933bf26799802640",
  education: "41ec968cd03180378496d10f9183e7bc",
  experience: "41ec968cd03180629cffe0b0d4279bd4",
  projects: "41ec968cd0318042a55ed66fd1a7bf48",
  research: "41ec968cd03180aa9b95ef380026bd9d",
  leadership: "41ec968cd031809bb527ff1b2fc449f1",
  achievements: "41ec968cd03180809723c30fc0e449c9",
  skills: "41ec968cd03180c9afd3d12dc130837e",
  interests: "41ec968cd03180418036d9cf207b044c",
  contact: "41ec968cd03180bca3b5f7364361310e"
};

const CRITICAL_DATABASES = ["profile"];

const BACKGROUND_DATABASES = [
  "education",
  "experience",
  "projects",
  "research",
  "leadership",
  "achievements",
  "skills",
  "interests",
  "contact"
];

const CONCURRENCY = 2;

export default async function handler(req, res) {
  const token = process.env.NOTION_API_KEY;

  if (!token) {
    return res.status(500).json({
      success: false,
      error: "Notion API key is missing"
    });
  }

  // Cache hasil API selama 60 detik.
  res.setHeader(
    "Cache-Control",
    "s-maxage=60, stale-while-revalidate=300"
  );

  const group = req.query?.group || "all";

  let selectedDatabases;

  if (group === "critical") {
    selectedDatabases = CRITICAL_DATABASES;
  } else if (group === "background") {
    selectedDatabases = BACKGROUND_DATABASES;
  } else if (group === "all") {
    selectedDatabases = Object.keys(DATABASES);
  } else {
    return res.status(400).json({
      success: false,
      error: "Invalid loading group"
    });
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
  };

  /* -------------------------------------------------------
     REQUEST QUEUE
  ------------------------------------------------------- */

  let activeRequests = 0;
  const requestQueue = [];

  async function limitedRequest(url, options = {}) {
    if (activeRequests >= CONCURRENCY) {
      await new Promise(resolve => {
        requestQueue.push(resolve);
      });
    }

    activeRequests++;

    try {
      for (let attempt = 0; attempt < 4; attempt++) {
        const response = await fetch(url, {
          ...options,
          headers
        });

        if (response.status === 429 && attempt < 3) {
          const delay = Number(
            response.headers.get("Retry-After") || 2
          );

          await new Promise(resolve =>
            setTimeout(resolve, delay * 1000)
          );

          continue;
        }

        return response;
      }

      throw new Error("Notion rate limit exceeded");

    } finally {
      activeRequests--;

      const next = requestQueue.shift();

      if (next) next();
    }
  }

  /* -------------------------------------------------------
     PARALLEL WORKER
  ------------------------------------------------------- */

  async function runWorkers(items, worker, limit = CONCURRENCY) {
    const results = new Array(items.length);
    let nextIndex = 0;

    async function runWorker() {
      while (true) {
        const index = nextIndex++;

        if (index >= items.length) return;

        try {
          results[index] = await worker(items[index], index);
        } catch (error) {
          results[index] = {
            success: false,
            error: error.message,
            results: []
          };
        }
      }
    }

    const workers = Array.from(
      { length: Math.min(limit, items.length) },
      () => runWorker()
    );

    await Promise.all(workers);

    return results;
  }

  /* -------------------------------------------------------
     PAGE CONTENT
  ------------------------------------------------------- */

  async function getPageContent(blockId) {
    const results = [];
    let cursor = null;

    try {
      do {
        const url = new URL(
          `https://api.notion.com/v1/blocks/${blockId}/children`
        );

        url.searchParams.set("page_size", "100");

        if (cursor) {
          url.searchParams.set("start_cursor", cursor);
        }

        const response = await limitedRequest(url.toString());
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Page content access failed"
          );
        }

        results.push(...data.results);

        cursor = data.has_more
          ? data.next_cursor
          : null;

      } while (cursor);

      // Nested blocks are retrieved recursively.
      for (const block of results) {
        if (block.has_children) {
          const nested = await getPageContent(block.id);

          block.children = nested.results || [];
        }
      }

      return {
        success: true,
        results
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        results
      };
    }
  }

  /* -------------------------------------------------------
     DATABASE WORKER
  ------------------------------------------------------- */

  async function getDatabase(id) {
    const results = [];
    let cursor = null;

    try {
      do {
        const response = await limitedRequest(
          `https://api.notion.com/v1/databases/${id}/query`,
          {
            method: "POST",
            body: JSON.stringify({
              page_size: 100,
              ...(cursor ? { start_cursor: cursor } : {})
            })
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Database access failed"
          );
        }

        results.push(...data.results);

        cursor = data.has_more
          ? data.next_cursor
          : null;

      } while (cursor);

      // Page content is retrieved by controlled workers.
      const pageResults = await runWorkers(
        results,
        async page => {
          const content = await getPageContent(page.id);

          return {
            ...page,
            content: content.results || [],
            content_success: content.success
          };
        },
        CONCURRENCY
      );

      return {
        success: true,
        results: pageResults
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        results: []
      };
    }
  }

  /* -------------------------------------------------------
     DATABASE DISPATCHER
  ------------------------------------------------------- */

  const databaseNames = selectedDatabases;

  const databaseResults = await runWorkers(
    databaseNames,
    async name => {
      return {
        name,
        data: await getDatabase(DATABASES[name])
      };
    },
    CONCURRENCY
  );

  const databases = {};

  databaseResults.forEach(item => {
    if (item?.name) {
      databases[item.name] = item.data;
    }
  });

  const failed = Object.values(databases)
    .some(database => !database.success);

  return res.status(200).json({
    success: true,
    group,
    databases,
    partial: failed
  });
}
