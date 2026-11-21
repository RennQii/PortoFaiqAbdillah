
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
      error: "Notion API key is missing"
    });
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
  };

  async function getDatabase(id) {
    let results = [];
    let cursor = null;

    try {
      do {
        const response = await fetch(
          `https://api.notion.com/v1/databases/${id}/query`,
          {
            method: "POST",
            headers,
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
            status: response.status
          };
        }

        results.push(...data.results);
        cursor = data.has_more ? data.next_cursor : null;

      } while (cursor);

      return {
        success: true,
        results
      };

    } catch (error) {
      return {
        success: false,
        error: "Failed to connect to Notion"
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
