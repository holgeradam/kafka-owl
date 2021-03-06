import { Component, ReactNode } from "react";
import React from "react";
import { TopicDetail, TopicConfigEntry, TopicMessage } from "../../../state/restInterfaces";
import { Table, Tooltip, Icon, Row, Statistic, Tabs, Descriptions, Popover, Skeleton, Radio, Checkbox, Button, Select, Input, Form, Divider, Typography, message, Tag, Drawer, Result, Alert, Empty, ConfigProvider, Modal } from "antd";
import { observer } from "mobx-react";
import { api, TopicMessageOffset, TopicMessageSortBy, TopicMessageDirection, TopicMessageSearchParameters } from "../../../state/backendApi";
import { uiSettings, PreviewTag } from "../../../state/ui";
import ReactJson, { CollapsedFieldProps } from 'react-json-view'
import { PageComponent, PageInitHelper } from "../Page";
import prettyMilliseconds from 'pretty-ms';
import prettyBytes from 'pretty-bytes';
import topicConfigInfo from '../../../assets/topicConfigInfo.json'
import { sortField, range, makePaginationConfig, Spacer } from "../../misc/common";
import { motion, AnimatePresence } from "framer-motion";
import { observable, computed, transaction } from "mobx";
import { findElementDeep, cullText, getAllKeys } from "../../../utils/utils";
import { FormComponentProps } from "antd/lib/form";
import { animProps, MotionAlways, MotionDiv } from "../../../utils/animationProps";
import Paragraph from "antd/lib/typography/Paragraph";
import { ColumnProps } from "antd/lib/table";
import '../../../utils/arrayExtensions';
import { uiState } from "../../../state/uiState";
import { FilterableDataSource } from "../../../utils/filterableDataSource";

const { Text } = Typography;
const { Option } = Select;
const InputGroup = Input.Group;



@observer
export class TopicMessageView extends Component<{ topic: TopicDetail }> {

    @observable requestInProgress = false;
    @observable searchParams: TopicMessageSearchParameters = {
        _offsetMode: TopicMessageOffset.End,
        startOffset: -1, partitionID: -1, pageSize: 50,
        sortOrder: TopicMessageDirection.Descending, sortType: TopicMessageSortBy.Offset
    };
    @observable previewDisplay: string[] = [];
    @observable allCurrentKeys: string[] = [];
    @observable showPreviewSettings = false;

    @observable fetchError = null as Error | null;

    pageConfig = makePaginationConfig(uiSettings.topicMessages.pageSize);
    messageSource = new FilterableDataSource<TopicMessage>(() => api.Messages, this.isFilterMatch);

    constructor(props: { topic: TopicDetail }) {
        super(props);
        this.executeMessageSearch = this.executeMessageSearch.bind(this); // needed because we must pass the function directly as 'submit' prop
        //this.updateFilter = this.updateFilter.bind(this);
    }

    componentDidMount() {
        this.executeMessageSearch();
    }
    componentWillUnmount() {
        this.messageSource.dispose();
    }

    render() {
        const topic = this.props.topic;
        const SearchForm = Form.create<SearchParametersProps>({ name: 'messageSearch' })(InnerSearchParametersForm);

        return <>
            {/* Message Search */}
            <SearchForm topic={topic} submit={this.executeMessageSearch} searchParams={this.searchParams} requestInProgress={this.requestInProgress} />

            {this.fetchError
                ? <Alert
                    type="error" showIcon
                    message="Backend API Error"
                    description={<div>
                        <Text>Please check and modify the request before resubmitting.</Text>
                        <div className='codeBox'>{this.fetchError.message}</div>
                    </div>}
                />
                : <>
                    {/* Quick Search Line */}
                    <Row align='middle' style={{ marginBottom: '1em', display: 'flex', alignItems: 'center' }} >

                        <Input placeholder='Quick Search' allowClear={true} size='large'
                            style={{ marginRight: '1em', width: 'auto', padding: '0', whiteSpace: 'nowrap' }}
                            onChange={e => this.messageSource.filterText = e.target.value}
                            addonAfter={null}
                        />
                        <this.FilterSummary />

                        <Spacer />
                        <this.SearchQueryAdditionalInfo />
                    </Row>

                    <this.MessageTable />
                </>
            }
        </>
    }

    isFilterMatch(str: string, m: TopicMessage) {
        str = str.toLowerCase();
        if (m.offset.toString().toLowerCase().includes(str)) return true;
        if (m.key && m.key.toLowerCase().includes(str)) return true;
        if (m.valueJson && m.valueJson.toLowerCase().includes(str)) return true;
        return false;
    }

    FilterSummary() {

        if (this && this.messageSource && this.messageSource.data) {
            // todo
        }
        else {
            return null;
        }

        const displayText = this.messageSource.data.length == api.Messages.length
            ? 'Filter matched all messages'
            : <><b>{this.messageSource.data.length}</b> results</>;

        return <div style={{ marginRight: '1em' }}>
            <MotionDiv identityKey={displayText}>
                <Text type='secondary'>{displayText}</Text>
            </MotionDiv>
        </div>
    }


    @computed
    get activeTags() {
        return uiSettings.topicList.previewTags.filter(t => t.active).map(t => t.value);
    }

    MessageTable = observer(() => {

        const valueTitle = <>
            <span>Value (Preview)</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', height: 0, marginLeft: '4px', transform: 'translateY(1px)' }}>
                <Button icon='setting' shape='circle' className='hoverBorder' onClick={() => this.showPreviewSettings = true} />
            </span>
        </>

        const columns: ColumnProps<TopicMessage>[] = [
            { width: 1, title: 'Offset', dataIndex: 'offset', sorter: sortField('offset'), defaultSortOrder: 'descend' },
            { width: 1, title: 'Timestamp', dataIndex: 'timestamp', sorter: sortField('timestamp'), render: (t: number) => new Date(t * 1000).toLocaleString() },
            { width: 1, title: 'Partition', dataIndex: 'partitionID', sorter: sortField('partitionID'), },
            { width: 1, title: 'Key', dataIndex: 'key', render: (t) => t },
            {
                title: valueTitle,
                dataIndex: 'value',
                render: (t, r) => <MessagePreview msg={r} previewFields={() => this.activeTags} />,
            },
            { width: 1, title: 'Size (≈)', dataIndex: 'size', align: 'right', render: (s) => { if (s > 1000) s = Math.round(s / 1000) * 1000; return prettyBytes(s) } },
            {
                width: 1,
                title: 'Action',
                key: 'action',
                render: (text, record) => (
                    <span>
                        <Button type='link' size='small' onClick={() => this.copyMessage(record)}>Copy</Button>
                        {/* <Divider type="vertical" /> */}
                    </span>
                ),
            },
        ];

        return <>
            <ConfigProvider renderEmpty={this.empty}>
                <Table
                    style={{ margin: '0', padding: '0', whiteSpace: 'nowrap' }}
                    bordered={true} size='small'
                    pagination={this.pageConfig}
                    onChange={x => { if (x.pageSize) { uiSettings.topicMessages.pageSize = x.pageSize; this.pageConfig.pageSize = x.pageSize; } }}
                    dataSource={this.messageSource.data}
                    loading={this.requestInProgress}
                    rowKey={r => r.offset + ' ' + r.partitionID + r.timestamp}

                    expandRowByClick={false}
                    expandedRowRender={record => RenderExpandedMessage(record)}
                    expandIconAsCell={false}
                    expandIconColumnIndex={columns.findIndex(c => c.dataIndex === 'value')}
                    columns={columns} />

                {(this.messageSource.data && this.messageSource.data.length > 0) && <this.PreviewSettings />}
            </ConfigProvider>
        </>
    })

    copyMessage(record: TopicMessage) {
        navigator.clipboard.writeText(record.valueJson);
        message.success('Message content (JSON) copied to clipboard', 5);
    }

    PreviewSettings = observer(() => {
        // const info = Modal.info({  visible:this.showPreviewSettings,  getContainer:false,  })

        const content = <>
            <Paragraph>
                <Text>Add any name to this list. If it exists in the message, then it will be shown in the preview.</Text><br />
                <Text>After you've added some fields, you can click on them to toggle them on/off.</Text>
            </Paragraph>
            <div style={{ padding: '1em', border: 'solid 1px #0001', borderRadius: '6px' }}>
                <CustomTagList tags={uiSettings.topicList.previewTags} allCurrentKeys={this.allCurrentKeys} />
            </div>
        </>

        if (this.showPreviewSettings) {
            Modal.info({
                title: 'Preview Fields',
                visible: this.showPreviewSettings,
                getContainer: false,
                content: content,
                onOk: () => this.showPreviewSettings = false,
                width: 1000,
                okText:'Close',
            });
        }

        return null;
    })


    async executeMessageSearch(): Promise<void> {
        const searchParams = this.searchParams;

        if (searchParams._offsetMode != TopicMessageOffset.Custom)
            searchParams.startOffset = searchParams._offsetMode;

        transaction(async () => {
            try {
                this.fetchError = null;
                this.requestInProgress = true;
                await api.searchTopicMessages(this.props.topic.topicName, searchParams);
                this.allCurrentKeys = Array.from(getAllKeys(this.messageSource.data));
            } catch (error) {
                console.error('error in searchTopicMessages: ' + error.toString());
                this.fetchError = error;
            } finally {
                this.requestInProgress = false;
            }
        });

    }

    SearchQueryAdditionalInfo = observer(() => {
        if (!api.MessageResponse) return null;
        if (api.MessageResponse.fetchedMessages === undefined) return null;
        const formatTime = (ms: number) => !!ms && ms > 0
            ? prettyMilliseconds(api.MessageResponse.elapsedMs, { secondsDecimalDigits: 2 })
            : "undefined";

        const warningDisplay = () => <>
            <Icon type="warning" theme="twoTone" twoToneColor="orange" style={{ fontSize: '150%', marginRight: '0.2em' }} />
            <Text type='warning' strong>
                Backend aborted the search after <b>{formatTime(api.MessageResponse.elapsedMs)}</b> (fetched {api.MessageResponse.fetchedMessages} messages)
            </Text>
        </>

        const typeTags = api.MessageResponse.messages.map(m => m.valueType).distinct().map(t => this.formatTypeToTag(t));

        const normalDisplay = () => <>
            <Text type='secondary'>
                <b>{api.MessageResponse.fetchedMessages}</b> messages (in <b>{formatTime(api.MessageResponse.elapsedMs)}</b>)
            </Text>
            <Divider type='vertical' />
            {typeTags}
        </>

        return <MotionAlways>
            <span style={{ display: 'flex', alignItems: 'center' }}>
                <Divider type='vertical' />
                {api.MessageResponse.isCancelled === true ? warningDisplay() : normalDisplay()}
            </span>
        </MotionAlways>
    })

    formatTypeToTag(type: string) {
        type = String(type);
        switch (type) {
            case 'json': return <Tag key={1} color='orange'>JSON</Tag>
            case 'xml': return <Tag key={2} color='green'>XML</Tag>
            case 'avro': return <Tag key={3} color='blue'>Avro</Tag>
            case 'binary': return <Tag key={4} color='red'>Binary</Tag>
            case 'text': return <Tag key={5} color='gold'>Text</Tag>
        }
        return <Tag key={6} color='black'>Unknown: {type}</Tag>
    }

    empty = () => <Empty description={<>
        <Text type='secondary' strong style={{ fontSize: '125%' }}>No messages</Text>
        <br />
        <span>Either the selected topic/partition did not contain any messages</span>
    </>} />
}

interface SearchParametersProps extends FormComponentProps {
    searchParams: TopicMessageSearchParameters;
    topic: TopicDetail;
    submit: (form: InnerSearchParametersForm) => void;
    requestInProgress: boolean;
}

@observer
class InnerSearchParametersForm extends Component<SearchParametersProps> {
    render() {
        const topic = this.props.topic;
        const searchParams = this.props.searchParams;
        const submit = this.props.submit;
        return (
            <Form layout='inline' colon={false} className='query-form' onSubmit={this.handleSubmit}>

                <Row>
                    {/* Offset */}
                    <Form.Item>
                        <InputGroup compact>
                            <Select<TopicMessageOffset> value={searchParams._offsetMode} onChange={e => searchParams._offsetMode = e}
                                dropdownMatchSelectWidth={false} style={{ width: '10em' }}>
                                <Option value={TopicMessageOffset.Custom}>Custom Offset</Option>
                                <Option value={TopicMessageOffset.Start}>Oldest Offset</Option>
                                <Option value={TopicMessageOffset.End}>Newest Offset</Option>
                            </Select>
                            <Input style={{ width: '8em' }} maxLength={20}
                                value={searchParams.startOffset} onChange={e => searchParams.startOffset = +e.target.value}
                                disabled={searchParams._offsetMode != TopicMessageOffset.Custom} />
                        </InputGroup>
                    </Form.Item>

                    {/* specific offset: lock partition to 'not all' */}
                    <Form.Item>
                        <Select<number> value={searchParams.partitionID} onChange={c => searchParams.partitionID = c} style={{ width: '9em' }}>
                            <Select.Option key='all' value={-1}>All Partitions</Select.Option>
                            {range(0, topic.partitionCount).map(i =>
                                <Select.Option key={i} value={i}>Partition {i.toString()}</Select.Option>)}
                        </Select>
                    </Form.Item>

                    <Form.Item>
                        <Select<number> value={searchParams.pageSize} onChange={c => searchParams.pageSize = c} style={{ width: '10em' }}>
                            {[1, 3, 5, 10, 20, 50, 100, 200, 500].map(i => <Select.Option key={i} value={i}>{i.toString()} results</Select.Option>)}
                        </Select>
                    </Form.Item>

                    {/* Timestamp/Offset */}
                    {/* <Form.Item>
                        <Radio.Group onChange={e => this.sortType = e.target.value} value={this.sortType}>
                            <Radio.Button value={TopicMessageSortBy.Offset}>Sort By Offset</Radio.Button>
                            <Radio.Button value={TopicMessageSortBy.Timestamp}>Sort By Timestamp</Radio.Button>
                        </Radio.Group>
                    </Form.Item> */}

                    {/* Asc/Desc */}
                    {/* <Form.Item>
                        <Radio.Group onChange={e => this.sortOrder = e.target.value} value={this.sortOrder}>
                            <Radio.Button value={TopicMessageDirection.Ascending}>Ascending</Radio.Button>
                            <Radio.Button value={TopicMessageDirection.Descending}>Descending</Radio.Button>
                        </Radio.Group>
                    </Form.Item> */}

                    <Form.Item>
                        <Button type='primary' icon='search' loading={this.props.requestInProgress} onClick={() => submit(this)} >Search</Button>
                    </Form.Item>
                </Row>

            </Form>
        );
    }

    handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        this.props.form.validateFields((err, values) => {
            if (!err) {
                console.log('Received values of form: ', values);
            } else {
                this.props.submit(this);
            }
        });
    };
}


@observer
class MessagePreview extends Component<{ msg: TopicMessage, previewFields: () => string[] }> {
    render() {
        const msg = this.props.msg;
        const value = msg.value;
        const fields = this.props.previewFields();

        try {
            let text: ReactNode = <></>;

            if (!value) { // 1. handle 'null'
                text = <code>null</code>
            }
            else if (msg.valueType == 'text') {
                text = value;
            }
            else if (msg.valueType == 'binary') {
                text = msg.valueBinHexPreview;
            }
            else if (fields.length > 0) { // 2. try preview fields
                const previewObj: any = {};
                for (let f of fields) {
                    var x = findElementDeep(value, f);
                    if (x) {
                        previewObj[f] = x;
                    }
                }
                text = cullText(JSON.stringify(previewObj), 100);
            }
            else { // 3. just stringify the whole object
                text = cullText(JSON.stringify(value), 100);
            }

            return <code><span className='cellDiv' style={{ fontSize: '85%' }}>{text}</span></code>
        }
        catch (e) {
            return <span style={{ color: 'red' }}>Error in RenderPreview: {e.toString()}</span>
        }
    }
}


function RenderExpandedMessage(msg: TopicMessage, shouldExpand?: ((x: CollapsedFieldProps) => boolean)) {
    try {
        if (!msg || !msg.value) return <code>null</code>
        const shouldCollapse = shouldExpand ? shouldExpand : false;

        if (msg.valueType == 'binary') {
            const mode = 'ascii' as ('ascii' | 'raw' | 'hex');
            if (mode == 'raw') {
                return <code style={{ fontSize: '.85em', lineHeight: '1em', whiteSpace: 'normal' }}>{msg.value}</code>
            }
            else if (mode == 'hex') {
                const str = msg.value as string;
                var hex = '';
                for (var i = 0; i < str.length; i++) {
                    let n = str.charCodeAt(i).toString(16);
                    if (n.length == 1) n = '0' + n;
                    hex += n + ' ';
                }

                return <code style={{ fontSize: '.85em', lineHeight: '1em', whiteSpace: 'normal' }}>{hex}</code>
            }
            else {
                const str = msg.value as string;
                var result = '';
                const isPrintable = /[\x20-\x7E]/;
                for (var i = 0; i < str.length; i++) {
                    let ch = String.fromCharCode(str.charCodeAt(i)); // str.charAt(i);
                    ch = isPrintable.test(ch) ? ch : '. ';
                    result += ch + ' ';
                }

                return <code style={{ fontSize: '.85em', lineHeight: '1em', whiteSpace: 'normal' }}>{result}</code>
            }
        }

        return (
            <>
                {/* <Affix offsetTop={30}>
                    <Button icon='copy' shape='circle' size='large'
                        style={{ float: 'right', margin: '1em', zIndex: 10 }} />
                </Affix> */}

                <ReactJson
                    style={{ fontSize: '.85em', lineHeight: '1em', whiteSpace: 'normal' }}
                    displayDataTypes={false} displayObjectSize={true} enableClipboard={false}
                    src={msg.value}
                    name={null}
                    collapseStringsAfterLength={40}
                    groupArraysAfterLength={100}
                    indentWidth={5}
                    iconStyle='triangle'
                    collapsed={2}
                    shouldCollapse={shouldCollapse}
                />
            </>
        )
    }
    catch (e) {
        return <span style={{ color: 'red' }}>Error in RenderExpandedMessage: {e.toString()}</span>
    }
}



@observer
class CustomTagList extends Component<{ tags: PreviewTag[], allCurrentKeys: string[] }> {
    @observable inputVisible = false;
    @observable inputValue = '';

    @observable activeTags: string[] = [];

    render() {

        const tagSuggestions = this.props.allCurrentKeys.filter(k => this.props.tags.all(t => t.value != k));

        return <>
            <AnimatePresence>
                <MotionDiv positionTransition style={{ padding: '.3em' }}>

                    {this.props.tags.map(v => <CustomTag key={v.value} tag={v} tagList={this} />)}

                    {this.inputVisible &&
                        <motion.span positionTransition>
                            <Input
                                ref={r => { if (r) { r.focus(); } }}
                                type="text"
                                size="small"
                                style={{ width: 78 }}
                                value={this.inputValue}
                                onChange={e => this.inputValue = e.target.value}
                                onBlur={this.handleInputConfirm}
                                onPressEnter={this.handleInputConfirm}
                            />
                        </motion.span>
                    }

                    {!this.inputVisible &&
                        <motion.span positionTransition>
                            <Button onClick={() => this.inputVisible = true} size='small' type='dashed'>
                                <Icon type='plus' style={{ color: '#999' }} />
                                <>Add Preview</>
                            </Button>
                        </motion.span>
                    }

                    <br />

                    {/* <Select<string> mode='tags'
                        style={{ minWidth: '26em' }} size='large'
                        placeholder='Enter properties for preview'
                    >
                        {tagSuggestions.map(k =>
                            <Select.Option key={k} value={k}>{k}</Select.Option>
                        )}
                    </Select> */}

                </MotionDiv>
            </AnimatePresence>
        </>
    }

    handleInputConfirm = () => {
        const tags = this.props.tags;
        const newTag = this.inputValue;
        if (newTag && tags.all(t => t.value != newTag)) {
            tags.push({ value: newTag, active: true });
        }
        this.inputVisible = false;
        this.inputValue = '';
    };

    get tags(): PreviewTag[] { return this.props.tags; }
    get tagNames(): string[] { return this.props.tags.map(t => t.value); }
    get activeTagNames(): string[] { return this.props.tags.filter(t => t.active).map(t => t.value); }

    setTagActive(tag: string, isActive: boolean) {
        if (!isActive) {
            this.activeTags.remove(tag);
        } else {
            this.activeTags.push(tag);
        }
    }

    removeTag(tag: string) {
        this.props.tags.removeAll(t => t.value === tag);
    }
}

@observer
class CustomTag extends Component<{ tag: PreviewTag, tagList: CustomTagList }> {
    @observable isActive = false;

    render() {
        const tag = this.props.tag;
        const list = this.props.tagList;
        const value = tag.value;

        return <motion.span>
            <Tag
                color={tag.active ? 'blue' : undefined}
                key={value}
                onClick={() => tag.active = !tag.active}
                closable
                onClose={() => list.removeTag(value)}
            >{value}</Tag>
        </motion.span>
    }
}
