export type FilterableTask = {
  name: string;
  status: "active" | "paused" | "archived";
  sources: string[];
  keywords: string[];
  topics: string[];
};

export type TaskFilters = {
  query: string;
  status: "all" | FilterableTask["status"];
  source: "all" | "web" | "rss" | "news_api";
};

export function filterScheduledTasks<T extends FilterableTask>(tasks: T[], filters: TaskFilters) {
  const query = filters.query.trim().toLowerCase();
  return tasks.filter(task => {
    const searchCorpus = [task.name, ...task.sources, ...task.keywords, ...task.topics].join(" ").toLowerCase();
    return (!query || searchCorpus.includes(query)) && (filters.status === "all" || task.status === filters.status) && (filters.source === "all" || task.sources.includes(filters.source));
  });
}
