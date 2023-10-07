import React, { ReactElement, ReactNode } from "react";
import { Flex } from "@chakra-ui/react";
interface PageLayoutProps {
  children: ReactNode;
}

const PageLayout = ({ children }: PageLayoutProps): ReactElement => {
  return (
    <Flex justifyContent="center">
      <Flex
        mt={{
          base: "10vh",
          md: "5vh",
        }}
        direction="column"
        width={{
          base: "100%",
          md: "50%",
        }}
        px={{
          base: 5,
          md: 10,
        }}
      >
        {children}
      </Flex>
    </Flex>
  );
};

export default PageLayout;
