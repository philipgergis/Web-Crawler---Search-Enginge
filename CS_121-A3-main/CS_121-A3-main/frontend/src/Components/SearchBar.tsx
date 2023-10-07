import React, { ReactElement, Dispatch, SetStateAction } from "react";
import { Input, Flex, IconButton } from "@chakra-ui/react";
import { Search2Icon } from "@chakra-ui/icons";
interface SearchBarProps {
  search: string;
  setSearch: Dispatch<SetStateAction<string>>;
  loading: boolean;
  fetchResults: (localOffset: number) => Promise<void>;
}

const SearchBar = ({
  search,
  setSearch,
  loading,
  fetchResults,
}: SearchBarProps): ReactElement => {
  return (
    <Flex direction="row">
      <Input
        borderRightRadius={0}
        placeholder="Search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            fetchResults(0);
          }
        }}
      />
      <IconButton
        onClick={() => {
          fetchResults(0);
        }}
        icon={<Search2Icon />}
        isLoading={loading}
        borderLeftRadius={0}
        aria-label="Search"
      />
    </Flex>
  );
};

export default SearchBar;
