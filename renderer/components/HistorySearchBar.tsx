import type { Profile } from '@shared/types';

type DateRange = 'all' | 'today' | '7d' | '30d' | 'custom';

type Props = {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  profileFilterId: string;
  onProfileFilterChange: (value: string) => void;
  profiles: Profile[];
  dateRange: DateRange;
  onDateRangeChange: (value: DateRange) => void;
  customFrom: string;
  onCustomFromChange: (value: string) => void;
  customTo: string;
  onCustomToChange: (value: string) => void;
  onSearch: () => void;
  onClear: () => void;
};

export function HistorySearchBar({
  searchQuery,
  onSearchQueryChange,
  profileFilterId,
  onProfileFilterChange,
  profiles,
  dateRange,
  onDateRangeChange,
  customFrom,
  onCustomFromChange,
  customTo,
  onCustomToChange,
  onSearch,
  onClear,
}: Props) {
  return (
    <div className="history-search">
      <input
        type="text"
        placeholder="Search by company, role, or keywords..."
        value={searchQuery}
        onChange={(e) => onSearchQueryChange(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && onSearch()}
        className="search-input"
      />
      <select
        className="history-profile-filter"
        value={profileFilterId}
        onChange={(e) => {
          onProfileFilterChange(e.target.value);
        }}
        title="Filter by profile"
      >
        <option value="">All profiles</option>
        {profiles.map((p) => (
          <option key={p.profile_id} value={p.profile_id}>
            {p.name}
          </option>
        ))}
      </select>
      <select
        className="history-date-filter"
        value={dateRange}
        onChange={(e) =>
          onDateRangeChange(e.target.value as DateRange)
        }
        title="Filter by date"
      >
        <option value="all">All time</option>
        <option value="today">Today</option>
        <option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option>
        <option value="custom">Custom range</option>
      </select>
      {dateRange === 'custom' && (
        <div className="history-date-custom-group">
          <input
            type="date"
            className="history-date-custom"
            value={customFrom}
            onChange={(e) => onCustomFromChange(e.target.value)}
            title="From date"
          />
          <input
            type="date"
            className="history-date-custom"
            value={customTo}
            onChange={(e) => onCustomToChange(e.target.value)}
            title="To date"
          />
        </div>
      )}
      <button onClick={onSearch} className="button-primary">
        Search
      </button>
      <button onClick={onClear} className="button-secondary">
        Clear
      </button>
    </div>
  );
}

