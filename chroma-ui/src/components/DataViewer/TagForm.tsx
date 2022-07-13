import {
  Input,
  InputGroup,
  InputLeftElement,
  useTheme
} from '@chakra-ui/react'
import React, { useState } from 'react'
import { BsTagFill, BsTag } from 'react-icons/bs'
import { useAppendTagByNameToDatapointsMutation, useRemoveTagFromDatapointsMutation } from '../../graphql/graphql'
import { datapointIndexToPointIndex } from './DataViewerUtils'

interface TagFormProps {
  selectedDatapointsIds: []
  datapoints: any[]
  setDatapointsAndRebuildFilters: (datapoints: any[]) => void
}

const TagForm: React.FC<TagFormProps> = ({ selectedDatapointsIds, datapoints, setDatapointsAndRebuildFilters }) => {
  const theme = useTheme()
  const noneSelected = selectedDatapointsIds.length === 0

  // state for the inputs
  const [newTag, setNewTag] = useState("")
  const [newUnTag, setNewUnTag] = useState("")

  // mutations
  const [addTagResult, addTag] = useAppendTagByNameToDatapointsMutation()
  const [unTagResult, unTag] = useRemoveTagFromDatapointsMutation()

  // callback for a new tag
  const onSubmitTagAll = (e: any) => {
    e.preventDefault()

    let splitNewTags = newTag.split(",")

    // get selected datapoint ids from selected projection ids
    var selectedPointsIds = selectedDatapointsIds.slice().map(selectedPointId => {
      return datapointIndexToPointIndex(selectedPointId)
    })

    // add the new tags to each datapoint
    splitNewTags.map(tag => {
      const variables = { tagName: tag, datapointIds: selectedDatapointsIds }
      addTag(variables)
    })

    // update our `datapoints` data structure with the new tags, this is an optimistic update
    // we handle this manually for now, since graphcache won't support it since the data was 
    // fetched with rest
    selectedPointsIds.forEach((point, index) => {
      var pointTags = datapoints[point].tags.slice()
      splitNewTags.forEach(splitNewTag => {
        const indexOf = pointTags.findIndex((currentTag: any) => {
          return currentTag.tag.name === splitNewTag.trim()
        })

        if (indexOf < 0) {
          pointTags.push({ "right_id": undefined, "tag": { "name": splitNewTag.trim() } })
        }
      })
      datapoints[point].tags = pointTags
    })

    // set new tag data which forces the rerender
    setDatapointsAndRebuildFilters([...datapoints])

    setNewTag("")
  }

  // callback for a new untag
  const onSubmitUntagAll = (e: any) => {
    e.preventDefault()

    let splitNewUnTags = newUnTag.split(",")

    var selectedPointsIds = selectedDatapointsIds.slice().map(selectedPointId => {
      return datapointIndexToPointIndex(selectedPointId)
    })

    splitNewUnTags.map(tag => {
      const variables = { tagName: tag, datapointIds: selectedDatapointsIds }
      unTag(variables)
    })

    selectedPointsIds.forEach(point => {
      var tags = datapoints[point].tags.slice()

      splitNewUnTags.forEach(splitNewTag => {
        const indexOf = tags.findIndex((currentTag: any) => {
          return currentTag.tag.name === splitNewTag.trim()
        })

        if (indexOf > -1) {
          tags.splice(indexOf, 1)
        }
      })
      datapoints[point].tags = tags
    })

    setDatapointsAndRebuildFilters([...datapoints])

    setNewUnTag("")
  }

  // input sanitiziation, direct passthrough right now
  const checkAndSetTag = (e: React.ChangeEvent<HTMLInputElement>, name: string) => {
    setNewTag(e.currentTarget.value)
  }

  // input sanitiziation, direct passthrough right now
  const checkAndSetUnTag = (e: React.ChangeEvent<HTMLInputElement>, name: string) => {
    setNewUnTag(e.currentTarget.value)
  }

  return (
    <>
      <form onSubmit={onSubmitTagAll} style={{ width: "100%" }}>
        <InputGroup ml={3} mt={2} mr={3} width="auto" pt={0}>
          <InputLeftElement
            pointerEvents='none'
            mt={-1}
            children={<BsTagFill color='gray.900' />}
          />
          <Input
            borderColor={"rgba(0,0,0,0)"}
            borderRadius={1}
            borderWidth={2}
            size="sm"
            onChange={(e: any) => checkAndSetTag(e, e.target.value)}
            isDisabled={noneSelected}
            value={newTag}
            _hover={{ borderColor: theme.colors.ch_gray.light }}
            _focus={{ borderColor: theme.colors.ch_blue }}
            placeholder='Tag selected' />
        </InputGroup>
      </form>

      <form onSubmit={onSubmitUntagAll} style={{ width: "100%" }}>
        <InputGroup ml={3} mr={3} width="auto" pt={0} mb={2}>
          <InputLeftElement
            pointerEvents='none'
            mt={-1}
            children={<BsTag color='gray.900' />}
          />
          <Input
            borderColor={"rgba(0,0,0,0)"}
            borderRadius={1}
            borderWidth={2}
            size="sm"
            value={newUnTag}
            onChange={(e: any) => checkAndSetUnTag(e, e.target.value)}
            isDisabled={noneSelected}
            _hover={{ borderColor: theme.colors.ch_gray.light }}
            _focus={{ borderColor: theme.colors.ch_blue }}
            placeholder='Untag selected' />
        </InputGroup>
      </form>
    </>
  )
}

export default TagForm