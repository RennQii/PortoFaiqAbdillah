
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

export default async function handler(req, res) {
  const token = process.env.NOTION_API_KEY;

  if (!token) {
    return res.status(500).json({
      success: false,
      error: "Notion API key is missing"
    });
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
  };

  async function notionRequest(url, options = {}) {
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

    throw new Error("Notion API rate limit exceeded");
  }

  // Mengambil seluruh isi halaman Notion
  async function getPageContent(blockId) {
    let results = [];
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

        const response = await notionRequest(url.toString());

        const data = await response.json();

        if (!response.ok) {
          return {
            success: false,
            error: data.message || "Page content access failed",
            results: []
          };
        }

        results.push(...data.results);
        cursor = data.has_more ? data.next_cursor : null;

      } while (cursor);

      // Ambil isi blok bertingkat jika tersedia
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
        results: []
      };
    }
  }

  // Mengambil data tabel database
  async function getDatabase(id) {
    let results = [];
    let cursor = null;

    try {
      do {
        const response = await notionRequest(
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
          return {
            success: false,
            error: data.message || "Database access failed",
            status: response.status,
            results: []
          };
        }

        results.push(...data.results);
        cursor = data.has_more ? data.next_cursor : null;

      } while (cursor);

      // Ambil isi halaman setiap entry
      for (const page of results) {
        const content = await getPageContent(page.id);

        page.content = content.results;
        page.content_success = content.success;
      }

      return {
        success: true,
        results
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        results: []
      };
    }
  }

  const databases = {};

  await Promise.all(
    Object.entries(DATABASES).map(async ([name, id]) => {
      databases[name] = await getDatabase(id);
    })
  );

  return res.status(200).json({
    success: true,
    databases
  });
}
