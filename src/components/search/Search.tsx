import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Search as SearchIcon, ArrowLeft, Calendar as CalendarIcon, Loader2, Sparkles, X } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { SecureCapsuleDB, DecryptedCapsule } from "@/lib/database";
import { aiService, SearchResult } from "@/lib/ai-service";
import { cn } from "@/lib/utils";

interface SearchProps {
  onCapsuleSelect: (capsuleId: string) => void;
  onBack: () => void;
}

interface SearchFilters {
  dateRange?: { start: Date; end: Date };
  sentiment?: 'positive' | 'neutral' | 'negative' | 'all';
  type?: 'text' | 'image' | 'mixed' | 'all';
}

export const Search = ({ onCapsuleSelect, onBack }: SearchProps) => {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [allCapsules, setAllCapsules] = useState<DecryptedCapsule[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);
  const { user, userKey } = useAuth();

  // Filters
  const [filters, setFilters] = useState<SearchFilters>({
    sentiment: 'all',
    type: 'all',
  });
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();

  // Load all capsules on mount
  useEffect(() => {
    const loadCapsules = async () => {
      if (!user || !userKey) {
        setInitialLoading(false);
        return;
      }

      try {
        const capsules = await SecureCapsuleDB.getUserCapsules(user.id, userKey);
        setAllCapsules(capsules);
      } catch (error) {
        console.error('Error loading capsules:', error);
      } finally {
        setInitialLoading(false);
      }
    };

    loadCapsules();
  }, [user, userKey]);

  const handleSearch = async () => {
    if (!query.trim() && !startDate && !endDate && filters.sentiment === 'all' && filters.type === 'all') {
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      // Apply filters first
      let filteredCapsules = [...allCapsules];

      // Date range filter
      if (startDate || endDate) {
        filteredCapsules = filteredCapsules.filter(capsule => {
          const capsuleDate = capsule.createdAt;
          if (startDate && capsuleDate < startDate) return false;
          if (endDate) {
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999);
            if (capsuleDate > endOfDay) return false;
          }
          return true;
        });
      }

      // Sentiment filter
      if (filters.sentiment && filters.sentiment !== 'all') {
        filteredCapsules = filteredCapsules.filter(
          capsule => capsule.sentiment === filters.sentiment
        );
      }

      // Type filter
      if (filters.type && filters.type !== 'all') {
        filteredCapsules = filteredCapsules.filter(
          capsule => capsule.type === filters.type
        );
      }

      // Perform semantic search if query exists
      if (query.trim()) {
        const results = await aiService.semanticSearch(query, filteredCapsules);
        setSearchResults(results);
      } else {
        // If no query, just show filtered results sorted by relevance (date)
        const results: SearchResult[] = filteredCapsules
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map(capsule => ({
            capsule,
            relevanceScore: 1.0,
            matchedContent: '',
          }));
        setSearchResults(results);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setQuery("");
    setStartDate(undefined);
    setEndDate(undefined);
    setFilters({ sentiment: 'all', type: 'all' });
    setSearchResults([]);
    setHasSearched(false);
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive': return 'bg-green-100 text-green-800';
      case 'negative': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);
    
    if (index === -1) return text;
    
    return (
      <>
        {text.substring(0, index)}
        <mark className="bg-yellow-200 font-semibold">
          {text.substring(index, index + query.length)}
        </mark>
        {text.substring(index + query.length)}
      </>
    );
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-blue-50 p-4 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-amber-600 mx-auto" />
          <p className="text-gray-600">Loading your capsules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-blue-50 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            onClick={onBack}
            variant="ghost"
            className="text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Dashboard
          </Button>
        </div>

        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-2 text-amber-600">
            <SearchIcon className="h-8 w-8" />
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-4xl font-bold text-gray-800">Search Your Memories</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Use natural language to find specific memories, or filter by date, sentiment, and type
          </p>
        </div>

        {/* Search Input and Filters */}
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardContent className="p-6 space-y-4">
            {/* Search Input */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search your memories... (e.g., 'happy moments', 'work achievements')"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10 pr-4 py-6 text-lg"
                />
              </div>
              <Button
                onClick={handleSearch}
                disabled={loading}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white px-8"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <SearchIcon className="h-5 w-5 mr-2" />
                    Search
                  </>
                )}
              </Button>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center">
              <div className="text-sm font-medium text-gray-700">Filters:</div>

              {/* Date Range Filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      (startDate || endDate) && "border-amber-500"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate || endDate ? (
                      <>
                        {startDate ? format(startDate, "MMM d, yyyy") : "Start"} -{" "}
                        {endDate ? format(endDate, "MMM d, yyyy") : "End"}
                      </>
                    ) : (
                      "Date Range"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4" align="start">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Start Date</label>
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">End Date</label>
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        disabled={(date) => startDate ? date < startDate : false}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStartDate(undefined);
                        setEndDate(undefined);
                      }}
                      className="w-full"
                    >
                      Clear Dates
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Sentiment Filter */}
              <Select
                value={filters.sentiment}
                onValueChange={(value) =>
                  setFilters({ ...filters, sentiment: value as 'all' | 'positive' | 'neutral' | 'negative' })
                }
              >
                <SelectTrigger className={cn(
                  "w-[180px]",
                  filters.sentiment !== 'all' && "border-amber-500"
                )}>
                  <SelectValue placeholder="Sentiment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sentiments</SelectItem>
                  <SelectItem value="positive">Positive</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="negative">Negative</SelectItem>
                </SelectContent>
              </Select>

              {/* Type Filter */}
              <Select
                value={filters.type}
                onValueChange={(value) =>
                  setFilters({ ...filters, type: value as 'all' | 'text' | 'image' | 'mixed' })
                }
              >
                <SelectTrigger className={cn(
                  "w-[180px]",
                  filters.type !== 'all' && "border-amber-500"
                )}>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>

              {/* Clear Filters Button */}
              {(query || startDate || endDate || filters.sentiment !== 'all' || filters.type !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-gray-600 hover:text-gray-800"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear All
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Search Results */}
        {hasSearched && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-gray-800">
                {searchResults.length} {searchResults.length === 1 ? 'Result' : 'Results'} Found
              </h2>
              {aiService.isAvailable() && query && (
                <Badge variant="outline" className="text-amber-600 border-amber-600">
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI-Powered Search
                </Badge>
              )}
            </div>

            {searchResults.length === 0 ? (
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardContent className="p-12 text-center space-y-4">
                  <SearchIcon className="h-16 w-16 text-gray-300 mx-auto" />
                  <h3 className="text-xl font-semibold text-gray-700">No Results Found</h3>
                  <p className="text-gray-600 max-w-md mx-auto">
                    We couldn't find any capsules matching your search criteria.
                  </p>
                  <div className="space-y-2 text-sm text-gray-500">
                    <p className="font-medium">Try:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Using different keywords</li>
                      <li>Removing some filters</li>
                      <li>Checking your spelling</li>
                      <li>Using more general terms</li>
                    </ul>
                  </div>
                  <Button
                    onClick={clearFilters}
                    variant="outline"
                    className="mt-4"
                  >
                    Clear Search and Filters
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {searchResults.map((result) => (
                  <Card
                    key={result.capsule.id}
                    className="border-0 shadow-lg bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 cursor-pointer"
                    onClick={() => onCapsuleSelect(result.capsule.id)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg text-gray-800 flex-1">
                          {query ? highlightMatch(result.capsule.title, query) : result.capsule.title}
                        </CardTitle>
                        <div className="flex flex-col gap-2 items-end">
                          {result.capsule.sentiment && (
                            <Badge className={getSentimentColor(result.capsule.sentiment)}>
                              {result.capsule.sentiment}
                            </Badge>
                          )}
                          {result.relevanceScore < 1 && (
                            <Badge variant="outline" className="text-xs">
                              {Math.round(result.relevanceScore * 100)}% match
                            </Badge>
                          )}
                        </div>
                      </div>
                      <CardDescription className="text-gray-600">
                        {format(result.capsule.createdAt, 'MMM d, yyyy')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-gray-700 text-sm line-clamp-3 mb-3">
                        {query ? highlightMatch(result.capsule.content, query) : result.capsule.content}
                      </p>
                      {result.matchedContent && (
                        <p className="text-xs text-gray-500 italic border-l-2 border-amber-300 pl-2">
                          {result.matchedContent}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                        <span className="capitalize">{result.capsule.type}</span>
                        <span>{result.capsule.isUnlocked ? '🔓 Unlocked' : '🔒 Locked'}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Initial State - No Search Yet */}
        {!hasSearched && (
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent className="p-12 text-center space-y-4">
              <SearchIcon className="h-16 w-16 text-amber-300 mx-auto" />
              <h3 className="text-xl font-semibold text-gray-700">Start Your Search</h3>
              <p className="text-gray-600 max-w-md mx-auto">
                Enter keywords or use filters to find specific memories from your collection of {allCapsules.length} capsules.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};
