import React from "react";
import {
  Card,
  CardBody,
  Text,
  CardHeader,
  Heading,
  Link,
} from "@chakra-ui/react";
import { result } from "../App";

const ResultCard = ({ url, title, preview }: result) => {
  return (
    <Card>
      <CardHeader pb={0}>
        <Heading
          size="sm"
          as={Link}
          href={url}
          color="blue.500"
          textDecoration="underline"
          isExternal
        >
          {title || url}
        </Heading>
      </CardHeader>
      <CardBody pt={1}>
        <Text color="green.500" fontSize="sm" as={Link} href={url} isExternal>
          {url}
        </Text>
        <Text>{preview}</Text>
      </CardBody>
    </Card>
  );
};

export default ResultCard;
