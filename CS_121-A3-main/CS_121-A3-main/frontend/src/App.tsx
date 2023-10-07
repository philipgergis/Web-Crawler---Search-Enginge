import { useEffect, useState } from "react";
import {
  Image,
  Flex,
  VStack,
  Text,
  Tooltip,
  Skeleton,
  Card,
  CardHeader,
  Heading,
  CardBody,
} from "@chakra-ui/react";
import InfiniteScroll from "react-infinite-scroll-component";
import SearchBar from "./Components/SearchBar";
import PageLayout from "./Components/PageLayout";
import uciIcsLogo from "./assets/uci_ics_logo.png";
import ResultCard from "./Components/ResultCard";
export interface result {
  url: string;
  title: string;
  preview: string;
}
export interface response {
  results: result[];
  total: number;
  time: number;
  searchTime: number;
}
const logger = (x: number) => console.log(`I am on line ${x}`);
const EndMessage = ({ text }: { text: string }) => {
  return (
    <Flex justifyContent="center" width="100%" py={5}>
      {text}
    </Flex>
  );
};
function App() {
  const [search, setSearch] = useState<string>("");
  const [results, setResults] = useState<result[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [offset, setOffset] = useState<number>(0);
  const [time, setTime] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [searchTime, setSearchTime] = useState<number>(0);
  const limit = 50;
  const [summary, setSummary] = useState<string>("");
  const [summaryloading, setSummaryLoading] = useState<boolean>(false);
  const fetchSummary = async () => {
    setSummaryLoading(true);
    try {
      const res = await fetch(`http://localhost:3000/openai?query=${search}`);
      const data = await res.json();
      setSummary(data.summary);
    } finally {
      setSummaryLoading(false);
    }
  };

  const fetchResults = async (localOffset = offset) => {
    setLoading(true);
    logger(39);
    try {
      console.log();
      const res = await fetch(
        `http://localhost:3000/search?query=${search}&limit=${limit}&offset=${localOffset}`
      );
      const data = (await res.json()) as response;
      if (localOffset === 0) {
        logger(46);
        console.log(offset);
        console.log(data.results);
        setResults(data.results);
        setTotal(data.total);
        setSearchTime(data.searchTime);
        setTime(data.time);
        fetchSummary();
      } else {
        logger(52);
        setResults((prevResults) => [...prevResults, ...data.results]);
      }
    } finally {
      setLoading(false);
    }
  };

  // useEffect(() => {
  //   const signal = new AbortController();

  //   fetchResults(0);
  //   logger(64);
  //   return () => {
  //     signal.abort();
  //   };
  // }, [search]);

  useEffect(() => {
    const signal = new AbortController();
    fetchResults(offset);
    logger(73);
    return () => {
      signal.abort();
    };
  }, [offset]);

  useEffect(() => {
    console.log({
      results: results.length,
      total,
      resultsObj: results,
    });
    if (
      results.length == total ||
      (limit * (offset + 1) > total && total !== 0)
    ) {
      setHasMore(false);
    } else {
      setHasMore(true);
    }
    console.log(`hasMore: ${hasMore}`);
  }, [results, total]);

  return (
    <PageLayout>
      <Flex justifyContent="center" mb={10}>
        <Image
          src={uciIcsLogo}
          alt="UCI ICS Logo"
          width={{
            base: "100%",
            md: "50%",
          }}
        />
      </Flex>
      <SearchBar
        search={search}
        setSearch={setSearch}
        loading={loading}
        fetchResults={fetchResults}
      />
      <Flex
        direction="row"
        justifyContent={"space-between"}
        width="100%"
        my={2}
      >
        {results.length ? (
          <Text fontSize="sm" color="gray.500">
            Total of {total} results
          </Text>
        ) : null}
        {results.length ? (
          <Tooltip label="Time to parse full HTML of each result + basic search">
            <Text fontSize="sm" color="gray.500">
              Full Results: {time}ms
            </Text>
          </Tooltip>
        ) : null}
      </Flex>
      <Flex
        direction="row"
        justifyContent={"space-between"}
        width="100%"
        my={2}
      >
        {results.length ? (
          <Text fontSize="sm" color="gray.500">
            {results.length} results showing, scroll for more
          </Text>
        ) : null}
        {results.length ? (
          <Tooltip label="Basic search time">
            <Text fontSize="sm" color="gray.500">
              URL Results: {searchTime}ms
            </Text>
          </Tooltip>
        ) : null}
      </Flex>
      <Skeleton width="100%" isLoaded={!summaryloading}>
        <Card mb={2}>
          <CardHeader>
            <Heading size="md">Summary of Results From Chat-GPT</Heading>
          </CardHeader>
          <CardBody>{summary}</CardBody>
        </Card>
      </Skeleton>
      <InfiniteScroll
        dataLength={results.length}
        next={() => setOffset(offset + 1)}
        hasMore={hasMore}
        loader={<EndMessage text="Loading..." />}
        endMessage={
          <EndMessage
            text={
              results.length === 0
                ? search === ""
                  ? "Search for something!"
                  : "No results found"
                : "No more results"
            }
          />
        }
      >
        {results.map((result) => (
          <ResultCard {...result} />
        ))}
      </InfiniteScroll>
    </PageLayout>
  );
}

export default App;
