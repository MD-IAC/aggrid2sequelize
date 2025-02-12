import { Op } from 'sequelize'

type DateFilter = {
    filterType: 'date',
    type: string,
    dateFrom: string,
    dateTo: string
}

type TextFilter = {
    filterType: 'text',
    type: string,
    filter: string
}

type FilterOperator = {
    filterType: 'operator',
    operator: 'AND' | 'OR',
    conditions: Filter[]
}

type FilterPrimitive = DateFilter | TextFilter

type Filter = FilterPrimitive | FilterOperator


function convertFilterDate(filter : DateFilter){
    switch(filter.type){
        case 'equals':
            return {
                [Op.eq]: filter.dateFrom.substring(0,10)
            }
        case 'notEqual':
            return {
                [Op.ne]: filter.dateFrom.substring(0,10)
            }
        case 'lessThan':
            return {
                [Op.lt]: filter.dateFrom.substring(0,10)
            }
        case 'greaterThan':
            return {
                [Op.gt]: filter.dateFrom.substring(0,10)
            }
        case 'blank':
            return {
                [Op.eq]: null
            }
        case 'notBlank':
            return {
                [Op.ne]: null
            }
        case 'inRange':
            return {
                [Op.and]: [
                    {
                        [Op.gte]: filter.dateFrom.substring(0,10)
                    },
                    {
                        [Op.lte]: filter.dateTo.substring(0,10)
                    }
                ]
            }
        default:
            throw 'Unrecognized filter type'
    }
}

function convertFilterText(filter : TextFilter){
    switch(filter.type){
        case 'contains':
            return {
                [Op.like]: `%${filter.filter}%`
            }
        case 'notContains':
            return {
                [Op.notLike]: `%${filter.filter}%`
            }
        case 'equals':
            return {
                [Op.eq]: filter.filter
            }
        case 'notEqual':
            return {
                [Op.ne]: filter.filter
            }
        case 'startsWith':
            return {
                [Op.like]: `${filter.filter}%`
            }
        case 'endsWith':
            return {
                [Op.like]: `%${filter.filter}`
            }
        case 'blank':
            return {
                [Op.or]: [
                    {
                        [Op.eq]: null,
                    },
                    {
                        [Op.eq]: ''
                    }
                ]
            }
        case 'notBlank':
            return {
                [Op.and]: [
                    {
                        [Op.ne]: null
                    },
                    {
                        [Op.ne]: ''
                    }
                ]
            }
        default:
            throw 'Unrecognized filter type'
    }
}


// AG Grid -> Sequelize : primitive operations
function convertFilterPrimitive(filter : FilterPrimitive){
    if(filter.filterType === 'date'){
        if('dateFrom' in filter && 'dateTo' in filter){
            return convertFilterDate(filter)
        }
    }
    if(filter.filterType === 'text'){
        return convertFilterText(filter)
    }
    throw 'Unrecognized filter filterType'
}


// AG Grid -> Sequelize
function convertFilter(filter : Filter) : {} {
    if(filter.filterType === 'operator'){
        switch(filter.operator){
            case 'OR':
                return {
                    [Op.or]: filter.conditions.map(convertFilter)
                }
            case 'AND':
                return {
                    [Op.and]: filter.conditions.map(convertFilter)
                }
            default:
                throw 'Unrecognized filter operator'
        }
    } else {
        return convertFilterPrimitive(filter)
    }
}


function agGridToSequelize({
    sequelize,
    query,
    columns,
    startRow,
    endRow,
    sortModel,
    filterModel
} : {
    sequelize : any,
    query : {},
    columns : {[key:string]: string},
    startRow : number,
    endRow: number,
    sortModel: {
        colId: string,
        sort: 'asc' | 'desc' | null
    }[],
    filterModel : {
        [key:string]: Filter
    }
}){
    const queryExtensions : {
        offset?:number,
        limit?:number,
        order?: [string, 'asc' | 'desc' | null][],
        where?: {
            [key:string]: any[]
        }
    }= {}
    let limit
    if(!isNaN(startRow) && !isNaN(endRow)){
        queryExtensions.offset = startRow
        limit = endRow - startRow + 1
    }
    
    if(limit && limit > 0){
        queryExtensions.limit = limit
    }

    if(sortModel){  
        queryExtensions.order = sortModel.map(({colId, sort}) => [
            [
                /* sort first by isnull(col)
                 * 0 if x is not null, 1 if x is null
                 * so in ASC order, null x will sort to the end of the list
                 */
                sequelize.fn('isnull', columns[colId]),
                sort
            ],
            [
                columns[colId],
                sort
            ]
        ] as [string, 'asc' | 'desc'][]).flat()
    }

    if(filterModel){
        queryExtensions.where = {
            [Op.and]: Object.keys(filterModel).map(
                key => sequelize.where(
                    //columnsMapWhere[key],
                    columns[key],
                    convertFilter(filterModel[key])
                )
            )
        }
    }

    return query
}

export {
    agGridToSequelize
}