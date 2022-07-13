import React, { useState, useEffect } from 'react'
import scatterplot from './scatterplot'
import { Box, useColorModeValue, Center, Spinner, Select } from '@chakra-ui/react'
import { Datapoint } from './DataViewTypes'
import useResizeObserver from "use-resize-observer";

interface ProjectionPlotterProps {
  datapoints?: Datapoint[]
  toolSelected: string
  showLoading: boolean
  filters?: any
  insertedProjections: boolean
  deselectHandler: () => void
  selectHandler: () => void
  cursor: string
  pointsToSelect: []
}

interface ConfigProps {
  scatterplot?: any
}

const getBounds = (datapoints: Datapoint[]) => {
  var minX = Infinity
  var minY = Infinity
  var maxX = -Infinity
  var maxY = -Infinity

  datapoints.forEach((datapoint) => {
    if (datapoint.projection!.y < minY) minY = datapoint.projection!.y
    if (datapoint.projection!.y > maxY) maxY = datapoint.projection!.y
    if (datapoint.projection!.x < minX) minX = datapoint.projection!.x
    if (datapoint.projection!.x > maxX) maxX = datapoint.projection!.x
  })

  var centerX = (maxX + minX) / 2
  var centerY = (maxY + minY) / 2

  var sizeX = (maxX - minX) / 2
  var sizeY = (maxY - minY) / 2

  return {
    minX: minX,
    maxX: maxX,
    minY: minY,
    maxY: maxY,
    centerX: centerX,
    centerY: centerY,
    maxSize: (sizeX > sizeY) ? sizeX : sizeY
  }
}

function minMaxNormalization(value: number, min: number, max: number) {
  return (value - min) / (max - min)
}

const ProjectionPlotter: React.FC<ProjectionPlotterProps> = ({
  cursor,
  insertedProjections,
  datapoints,
  showLoading,
  toolSelected,
  filters,
  selectHandler,
  deselectHandler,
  pointsToSelect }
) => {
  let [reglInitialized, setReglInitialized] = useState(false);
  let [boundsSet, setBoundsSet] = useState(false);
  let [config, setConfig] = useState<ConfigProps>({})
  let [points, setPoints] = useState<any>(undefined)
  let [target, setTarget] = useState<any>(undefined)
  let [maxSize, setMaxSize] = useState<any>(undefined)
  let [colorByFilterString, setColorByFilterString] = useState('Labels')
  let [colorByOptions, setColorByOptions] = useState([])
  const bgColor = useColorModeValue("#F3F5F6", '#0c0c0b')
  const { ref, width = 1, height = 1 } = useResizeObserver<HTMLDivElement>({
    onResize: ({ width, height }) => { // eslint-disable-line @typescript-eslint/no-shadow
      if (config.scatterplot !== undefined) {
        config.scatterplot.resizeHandler()
        resizeListener()
      }
    }
  })

  // whenever datapoints changes, we want to regenerate out points and send them down to plotter
  useEffect(() => {
    if (insertedProjections !== true) return
    if (datapoints === undefined) return
    if (boundsSet) return

    let bounds = getBounds(datapoints)
    setTarget([bounds.centerX, bounds.centerY])
    setMaxSize(bounds.maxSize)
    calculateColorsAndDrawPoints()

    if (boundsSet == false) {
      config.scatterplot.set({
        cameraDistance: (bounds.maxSize * 1.4),
        minCameraDistance: (bounds.maxSize * 1.4) * (1 / 20),
        maxCameraDistance: (bounds.maxSize * 1.4) * 3,
        cameraTarget: [bounds.centerX, bounds.centerY],
      })
      setBoundsSet(true)
    }

  }, [insertedProjections, datapoints])

  // whenever datapoints changes, we want to regenerate out points and send them down to plotter
  useEffect(() => {
    if (insertedProjections !== true) return
    if (datapoints === undefined) return
    calculateColorsAndDrawPoints()
  }, [datapoints])

  useEffect(() => {
    if (reglInitialized && (points !== null) && (config.scatterplot !== undefined)) {
      config.scatterplot.select(pointsToSelect)
    }
  }, [pointsToSelect])

  if (reglInitialized && (points !== null)) {
    if (toolSelected == 'lasso') {
      config.scatterplot.setLassoOverride(true)
    } else {
      config.scatterplot.setLassoOverride(false)
    }
  }

  // whenever points change, redraw
  useEffect(() => {
    if (reglInitialized && points !== null) {
      config.scatterplot.set({ pointColor: colorByOptions });
      config.scatterplot.draw(points)
    }
  }, [points])

  // whenever colorByFilterString change, redraw
  useEffect(() => {
    if (insertedProjections !== true) return
    if (datapoints === undefined) return
    calculateColorsAndDrawPoints()
  }, [colorByFilterString])

  const calculateColorsAndDrawPoints = () => {
    let colorByFilter = filters.find((a: any) => a.name == colorByFilterString)

    let colorByOptionsSave
    if (colorByFilter.type == 'discrete') colorByOptionsSave = colorByFilter.optionsSet.map((option: any) => option.color)
    if (colorByFilter.type == 'continuous') colorByOptionsSave = colorByFilter.optionsSet.colors
    setColorByOptions(colorByOptionsSave)

    points = [[0, 0, 0, 0]] // this make the ids in regl-scatterplot (zero-indexed) match our database ids (not zero-indexed)
    datapoints!.map(datapoint => {
      let datapointColorByProp = colorByFilter.fetchFn(datapoint)[0]

      let datapointColorIndex
      if (colorByFilter.type == 'discrete') datapointColorIndex = colorByFilter.optionsSet.findIndex((option: any) => option.name == datapointColorByProp)
      if (colorByFilter.type == 'continuous') datapointColorIndex = minMaxNormalization(datapointColorByProp, colorByFilter.optionsSet.min, colorByFilter.optionsSet.max) // normalize

      const visible = datapoint.visible ? 1 : 0
      return points.push([datapoint.projection?.x, datapoint.projection?.y, visible, datapointColorIndex])
    })
    setPoints(points)
  }

  const resizeListener = () => {
    var canvas = document.getElementById("regl-canvas")
    var container = document.getElementById("regl-canvas-container")
    canvas!.style.width = container?.clientWidth + "px"
    canvas!.style.height = container?.clientHeight + "px"
  };

  // resize our scatterplot on window resize
  useEffect(() => {
    window.addEventListener('resize', resizeListener);
    return () => {
      window.removeEventListener('resize', resizeListener);
    }
  }, [])

  function getRef(canvasRef: any) {
    if (!canvasRef) return;
    if (!reglInitialized && (points !== null)) {
      scatterplot(points,
        colorByOptions,
        {
          pixelRatio: Math.min(1.5, window.devicePixelRatio),
          canvas: canvasRef,
          deselectHandler: deselectHandler,
          selectHandler: selectHandler,
          target: target,
          distance: maxSize * 1.2
        }
      ).then((scatterplotConfig: any) => {
        setReglInitialized(true)
        setConfig(scatterplotConfig)
      }).catch(err => {
        console.error("could not setup regl")
        setReglInitialized(false)
      });
    }
  }

  const newColorBy = (event: any) => {
    setColorByFilterString(event.target.value)
  }

  if (points === null) showLoading = true

  let validFilters
  if (filters !== undefined) {
    const noFilterList = ["Tags"]
    validFilters = filters.filter((f: any) => !noFilterList.includes(f.name))
  }

  // how we set the cursor is a bit of a hack. if we have a custom cursor name
  // the cursor setting will fail, but our class will succeed in setting it
  // and vice versa
  return (
    <Box flex='1' ref={ref} cursor={cursor} className={cursor} id="regl-canvas-container" minWidth={0} marginTop="48px" width="800px">
      {(filters !== undefined) ?
        <Select pos="absolute" width={150} marginTop="10px" marginLeft="10px" value={colorByFilterString} onChange={newColorBy}>
          {validFilters.map((filterb: any) => {
            return (
              <option key={filterb.name} value={filterb.name} >{filterb.name}</option>
            )
          })}
        </Select>
        : null}
      {
        showLoading ?
          <Center height="100vh" bgColor={bgColor} >
            <Spinner size='xl' />
          </Center >
          :
          <canvas
            id="regl-canvas"
            ref={getRef.bind(this)}
            style={{ backgroundColor: bgColor, height: "100%", width: "100%" }}
          ></canvas>
      }
    </Box>
  )
}

export default ProjectionPlotter