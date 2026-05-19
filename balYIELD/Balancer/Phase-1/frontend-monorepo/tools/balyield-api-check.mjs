const endpoint = 'https://api-v3.balancer.fi/graphql'

async function gql(query, variables) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'user-agent': 'balYIELD-local',
    },
    body: JSON.stringify({ query, variables }),
  })

  console.log(response.status, response.headers.get('content-type'))
  console.log(await response.text())
}

await gql(
  `query Pools($chain: [GqlChain!]) {
    poolGetPools(first: 1, where: { chainIn: $chain }) {
      id
      address
      name
      symbol
      type
      chain
      protocolVersion
    }
  }`,
  { chain: ['BASE'] }
)

await gql(
  `query Pool($id: String!, $chain: GqlChain!) {
    poolGetPool(id: $id, chain: $chain) {
      id
      address
      name
      symbol
      type
      chain
      protocolVersion
    }
  }`,
  {
    id: '0x699d1a9f005dc6641be27182c8e23ef2027ba801',
    chain: 'BASE',
  }
)
